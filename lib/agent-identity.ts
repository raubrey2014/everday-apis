import crypto from 'crypto'

// JWE (RFC 7516) implementation for agent identity tokens.
// Machine Cuts hosts its RSA public key at /.well-known/agent-identity-keys so
// agent issuers can encrypt identity claims that only this service can decrypt.
//
// Algorithm: RSA-OAEP-256 (key wrap) + AES-256-GCM (content encryption)

export interface AgentIdentityClaims {
  name: string
  email: string
}

// In-process key pair cache. Production: set AGENT_IDENTITY_PRIVATE_KEY and
// AGENT_IDENTITY_PUBLIC_KEY (base64-encoded DER: PKCS8 / SPKI respectively).
// Without env vars a fresh pair is generated per process (dev/demo only —
// tokens created before a restart won't decrypt after it).
let _keys: { privateKey: crypto.KeyObject; publicKey: crypto.KeyObject } | null = null

function getKeyPair(): { privateKey: crypto.KeyObject; publicKey: crypto.KeyObject } {
  if (_keys) return _keys

  const privEnv = process.env.AGENT_IDENTITY_PRIVATE_KEY
  const pubEnv = process.env.AGENT_IDENTITY_PUBLIC_KEY

  if (privEnv && pubEnv) {
    _keys = {
      privateKey: crypto.createPrivateKey({ key: Buffer.from(privEnv, 'base64'), format: 'der', type: 'pkcs8' }),
      publicKey: crypto.createPublicKey({ key: Buffer.from(pubEnv, 'base64'), format: 'der', type: 'spki' }),
    }
  } else {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    _keys = { privateKey, publicKey }
  }

  return _keys
}

// Returns the JWK set to publish at /.well-known/agent-identity-keys.
export function getPublicKeyJwkSet(): object {
  const { publicKey } = getKeyPair()
  const jwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>
  return {
    'agent-identity-keys': [
      { kid: 'machine-cuts-identity-v1', use: 'enc', alg: 'RSA-OAEP-256', enc: 'A256GCM', ...jwk },
    ],
  }
}

// Encrypts claims into a JWE compact token using Machine Cuts' own public key.
// Useful for the demo token-creation endpoint.
export function createAgentIdentityToken(claims: AgentIdentityClaims): string {
  return jweEncrypt(claims, getKeyPair().publicKey)
}

// Encrypts claims using any RSA public key (agents fetch it from the well-known endpoint).
export function jweEncrypt(claims: AgentIdentityClaims, publicKey: crypto.KeyObject): string {
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'RSA-OAEP-256', enc: 'A256GCM' })).toString('base64url')
  const cek = crypto.randomBytes(32) // 256-bit CEK
  const iv = crypto.randomBytes(12)  // 96-bit IV for AES-GCM

  const encryptedCek = crypto.publicEncrypt(
    { key: publicKey, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
    cek,
  )

  const cipher = crypto.createCipheriv('aes-256-gcm', cek, iv)
  cipher.setAAD(Buffer.from(headerB64, 'ascii')) // JWE AAD = ASCII(header)
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(claims), 'utf8')), cipher.final()])
  const tag = cipher.getAuthTag() // 128-bit GCM auth tag

  return [headerB64, encryptedCek.toString('base64url'), iv.toString('base64url'), ciphertext.toString('base64url'), tag.toString('base64url')].join('.')
}

// Decrypts a JWE compact token and returns the identity claims, or null on any failure.
export function decryptAgentIdentityToken(token: string | null): AgentIdentityClaims | null {
  if (!token) return null

  const parts = token.split('.')
  if (parts.length !== 5) return null
  const [headerB64, encCekB64, ivB64, ciphertextB64, tagB64] = parts

  try {
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as { alg?: string; enc?: string }
    if (header.alg !== 'RSA-OAEP-256' || header.enc !== 'A256GCM') return null

    const { privateKey } = getKeyPair()
    const cek = crypto.privateDecrypt(
      { key: privateKey, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
      Buffer.from(encCekB64, 'base64url'),
    )

    const decipher = crypto.createDecipheriv('aes-256-gcm', cek, Buffer.from(ivB64, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
    decipher.setAAD(Buffer.from(headerB64, 'ascii'))
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64url')), decipher.final()])

    const claims = JSON.parse(plaintext.toString('utf8')) as unknown
    if (
      typeof claims !== 'object' || claims === null ||
      typeof (claims as Record<string, unknown>).name !== 'string' ||
      typeof (claims as Record<string, unknown>).email !== 'string'
    ) return null

    return claims as AgentIdentityClaims
  } catch {
    return null
  }
}
