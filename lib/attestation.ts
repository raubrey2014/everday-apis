import crypto from 'crypto'

const TOKEN_TYPE = 0x0002
const TOKEN_SIZE = 610

// ── Component-based validation (used by MCP server) ──────────────────────────
// buyagent passes attestation as separate headers: authenticator (RSA-PSS sig),
// prepared (the message that was signed), keyId (SHA-256 of issuer SPKI), issuerUrl.

export interface AttestationComponents {
  authenticator: string | null // base64url
  prepared: string | null      // base64url
  keyId: string | null         // base64url
  issuerUrl: string | null
}

async function fetchSpkiForKeyId(issuerUrl: string, keyIdBuf: Buffer): Promise<Buffer | null> {
  try {
    const res = await fetch(`${issuerUrl}/.well-known/private-token-issuer-directory`)
    if (!res.ok) return null
    const dir = await res.json() as { 'token-keys': Array<{ 'token-type': number; 'token-key': string }> }
    for (const entry of dir['token-keys']) {
      if (entry['token-type'] !== TOKEN_TYPE) continue
      const spki = Buffer.from(entry['token-key'], 'base64url')
      if (crypto.createHash('sha256').update(spki).digest().equals(keyIdBuf)) return spki
    }
  } catch { /* fall through */ }
  return null
}

export async function validateAttestationComponents(c: AttestationComponents): Promise<boolean> {
  if (!c.authenticator || !c.prepared || !c.keyId || !c.issuerUrl) return false

  let authenticatorBuf: Buffer, preparedBuf: Buffer, keyIdBuf: Buffer
  try {
    authenticatorBuf = Buffer.from(c.authenticator, 'base64url')
    preparedBuf = Buffer.from(c.prepared, 'base64url')
    keyIdBuf = Buffer.from(c.keyId, 'base64url')
  } catch { return false }

  const spki = await fetchSpkiForKeyId(c.issuerUrl, keyIdBuf)
  if (!spki) return false

  try {
    return crypto.verify(
      'SHA384',
      preparedBuf,
      { key: spki, format: 'der', type: 'spki', padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 48 },
      authenticatorBuf,
    )
  } catch { return false }
}

interface ParsedToken {
  tokenType: number
  nonce: Buffer
  challengeDigest: Buffer
  tokenKeyId: Buffer
  authenticator: Buffer
}

function parseToken(buf: Buffer): ParsedToken {
  return {
    tokenType: buf.readUInt16BE(0),
    nonce: buf.subarray(2, 34),
    challengeDigest: buf.subarray(34, 66),
    tokenKeyId: buf.subarray(66, 98),
    authenticator: buf.subarray(98, 610),
  }
}

async function fetchIssuerKey(tokenKeyId: Buffer): Promise<Buffer> {
  const issuerUrl = process.env.ATTESTATION_ISSUER_URL
  if (!issuerUrl) throw new Error('ATTESTATION_ISSUER_URL not configured')

  const res = await fetch(`${issuerUrl}/.well-known/private-token-issuer-directory`)
  if (!res.ok) throw new Error(`Issuer directory fetch failed: ${res.status}`)
  const dir = await res.json() as { 'token-keys': Array<{ 'token-type': number; 'token-key': string }> }

  for (const entry of dir['token-keys']) {
    if (entry['token-type'] !== TOKEN_TYPE) continue
    const spki = Buffer.from(entry['token-key'], 'base64url')
    const keyId = crypto.createHash('sha256').update(spki).digest()
    if (keyId.equals(tokenKeyId)) return spki
  }
  throw new Error('No matching issuer key for token_key_id')
}

export async function validateAttestationToken(header: string | null): Promise<boolean> {
  if (!header) return false

  let buf: Buffer
  try {
    buf = Buffer.from(header, 'base64')
  } catch {
    return false
  }

  if (buf.length !== TOKEN_SIZE) return false

  const token = parseToken(buf)
  if (token.tokenType !== TOKEN_TYPE) return false

  let spki: Buffer
  try {
    spki = await fetchIssuerKey(token.tokenKeyId)
  } catch {
    return false
  }

  const message = Buffer.concat([
    Buffer.from([0x00, 0x02]),
    token.nonce,
    token.challengeDigest,
    token.tokenKeyId,
  ])

  try {
    return crypto.verify(
      'SHA384',
      message,
      {
        key: spki,
        format: 'der',
        type: 'spki',
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 48,
      },
      token.authenticator,
    )
  } catch {
    return false
  }
}
