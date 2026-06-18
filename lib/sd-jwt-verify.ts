// Verifies Identity-Presentation values from the AAP pre-provisioned and issuer-mediated lanes.
//
// Accepts two formats in the Identity-Presentation header:
//
//   SD-JWT-VC (pre-provisioned lane):
//     <issuer-signed-jwt>~<disc1>~<disc2>~<KB-JWT>
//
//   aap-claims+jwt (issuer-mediated lane):
//     <signed JWT with typ=aap-claims+jwt>
//
// Both are verified against the IDP's published JWKS (ATTESTATION_ISSUER_URL env var).
// Returns the decoded claim values on success, or null on any verification failure.

import crypto from 'crypto'
import { decryptClaimsJwe } from '@/lib/service-jwk'

export interface VerifyOptions {
  aud: string    // this service's own origin
  nonce: string  // nonce from the claims-required challenge
}

type JwtHeader = { alg?: string; typ?: string; kid?: string }
type JwtPayload = Record<string, unknown>

function splitJwt(token: string): { header: JwtHeader; payload: JwtPayload; sigInput: string; sig: Buffer } | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as JwtHeader
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as JwtPayload
    return { header, payload, sigInput: `${parts[0]}.${parts[1]}`, sig: Buffer.from(parts[2], 'base64url') }
  } catch { return null }
}

// Fetches and caches the IDP's JWKS for claims verification.
// Keyed by issuer URL; refreshed if a kid is not found (key rotation).
const _jwksCache = new Map<string, { keys: JwkEntry[]; fetchedAt: number }>()
const JWKS_TTL_MS = 60 * 60 * 1000  // 1 hour

interface JwkEntry { kid?: string; kty: string; crv?: string; x?: string; n?: string; e?: string; use?: string; alg?: string }

async function fetchJwks(issuerUrl: string): Promise<JwkEntry[]> {
  const cached = _jwksCache.get(issuerUrl)
  if (cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) return cached.keys

  const res = await fetch(`${issuerUrl}/.well-known/agent-attestation/jwks.json`)
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`)
  const { keys } = await res.json() as { keys: JwkEntry[] }
  _jwksCache.set(issuerUrl, { keys, fetchedAt: Date.now() })
  return keys
}

function importPublicKey(jwk: JwkEntry): crypto.KeyObject | null {
  try {
    return crypto.createPublicKey({ key: jwk as unknown as crypto.JsonWebKey, format: 'jwk' })
  } catch { return null }
}

function verifyEdDsaJwt(sigInput: string, sig: Buffer, key: crypto.KeyObject): boolean {
  try {
    return crypto.verify(null, Buffer.from(sigInput), key, sig)
  } catch { return false }
}

function checkExpiry(payload: JwtPayload): boolean {
  const exp = payload.exp
  if (typeof exp !== 'number') return true  // no expiry claim → treat as valid
  return exp > Math.floor(Date.now() / 1000)
}

// ── Main verifier ─────────────────────────────────────────────────────────────

export async function verifyIdentityPresentation(
  headerValue: string | null,
  opts: VerifyOptions,
): Promise<Record<string, unknown> | null> {
  if (!headerValue) return null

  const issuerUrl = process.env.ATTESTATION_ISSUER_URL
  if (!issuerUrl) {
    console.error('[sd-jwt-verify] ATTESTATION_ISSUER_URL not set')
    return null
  }

  // Detect format: SD-JWT-VC contains '~'; plain JWT does not.
  if (headerValue.includes('~')) {
    return verifySdJwtPresentation(headerValue, opts, issuerUrl)
  }
  return verifyAapClaimsJwt(headerValue, opts, issuerUrl)
}

// ── SD-JWT-VC (pre-provisioned lane) ─────────────────────────────────────────

async function verifySdJwtPresentation(
  presentation: string,
  opts: VerifyOptions,
  issuerUrl: string,
): Promise<Record<string, unknown> | null> {
  const parts = presentation.split('~')
  // Format: issuer-jwt ~ disc1 ~ disc2 ~ ... ~ kb-jwt
  // The last non-empty part is the KB-JWT; everything between is disclosures.
  if (parts.length < 2) return null

  const issuerJwtStr = parts[0]
  const kbJwtStr = parts[parts.length - 1]  // KB-JWT is always last
  const disclosureParts = parts.slice(1, -1).filter(Boolean)

  // 1. Parse and verify the issuer-signed JWT
  const issuerJwt = splitJwt(issuerJwtStr)
  if (!issuerJwt) return null
  if (issuerJwt.header.typ !== 'dc+sd-jwt') return null

  const jwks = await fetchJwks(issuerUrl).catch(() => null)
  if (!jwks) return null

  const issuerKey = findKey(jwks, issuerJwt.header.kid)
  if (!issuerKey) return null
  if (!verifyEdDsaJwt(issuerJwt.sigInput, issuerJwt.sig, issuerKey)) return null
  if (!checkExpiry(issuerJwt.payload)) return null

  // 2. Verify each disclosure hash against the credential's _sd set
  const sdSet = new Set(issuerJwt.payload._sd as string[] ?? [])
  const claims: Record<string, unknown> = {}

  for (const disc of disclosureParts) {
    const hash = crypto.createHash('sha256').update(disc).digest('base64url')
    if (!sdSet.has(hash)) return null  // disclosure not in credential
    try {
      const [, key, value] = JSON.parse(Buffer.from(disc, 'base64url').toString()) as [string, string, unknown]
      claims[key] = value
    } catch { return null }
  }

  // 3. Verify the KB-JWT
  if (!kbJwtStr) return null
  const kbJwt = splitJwt(kbJwtStr)
  if (!kbJwt) return null
  if (kbJwt.header.typ !== 'kb+jwt') return null

  // KB-JWT is signed by the holder key in the credential's cnf.jwk
  const cnf = issuerJwt.payload.cnf as { jwk?: JwkEntry } | undefined
  if (!cnf?.jwk) return null
  const holderKey = importPublicKey(cnf.jwk)
  if (!holderKey) return null
  if (!verifyEdDsaJwt(kbJwt.sigInput, kbJwt.sig, holderKey)) return null

  // KB-JWT must bind to this service and the challenge nonce
  if (kbJwt.payload.aud !== opts.aud) return null
  if (kbJwt.payload.nonce !== opts.nonce) return null

  // sd_hash must match SHA-256 of the presentation up to (not including) the KB-JWT
  const presentationWithoutKb = `${issuerJwtStr}~${disclosureParts.join('~')}~`
  const expectedSdHash = crypto.createHash('sha256').update(presentationWithoutKb).digest('base64url')
  if (kbJwt.payload.sd_hash !== expectedSdHash) return null

  return claims
}

// ── aap-claims+jwt (issuer-mediated lane) ────────────────────────────────────

async function verifyAapClaimsJwt(
  token: string,
  opts: VerifyOptions,
  issuerUrl: string,
): Promise<Record<string, unknown> | null> {
  // Compact JWE has 5 dot-separated parts; compact JWT has 3.
  let jwtString = token
  if (token.split('.').length === 5) {
    try {
      jwtString = await decryptClaimsJwe(token)
    } catch {
      return null
    }
  }
  const parsed = splitJwt(jwtString)
  if (!parsed) return null
  if (parsed.header.typ !== 'aap-claims+jwt') return null

  const jwks = await fetchJwks(issuerUrl).catch(() => null)
  if (!jwks) return null

  const key = findKey(jwks, parsed.header.kid)
  if (!key) return null
  if (!verifyEdDsaJwt(parsed.sigInput, parsed.sig, key)) return null
  if (!checkExpiry(parsed.payload)) return null

  // Audience and nonce binding
  const audVal = parsed.payload.aud
  const aud = Array.isArray(audVal) ? audVal[0] : audVal
  if (aud !== opts.aud) return null
  if (parsed.payload.nonce !== opts.nonce) return null

  // Strip JWT-reserved fields; return only identity claims
  const { iss, aud: _aud, iat, exp, nonce: _nonce, ...claimValues } = parsed.payload
  void iss; void _aud; void iat; void exp; void _nonce
  return claimValues
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findKey(jwks: JwkEntry[], kid?: string): crypto.KeyObject | null {
  const candidates = kid ? jwks.filter(k => k.kid === kid) : jwks
  for (const jwk of candidates) {
    const key = importPublicKey(jwk)
    if (key) return key
  }
  return null
}
