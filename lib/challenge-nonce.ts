// Stateless HMAC-signed nonces for the urn:aap:claims-required challenge.
//
// Because everyday-apis runs as serverless functions with no persistent state
// between invocations, we cannot store issued nonces in memory or a DB. Instead
// the nonce embeds a timestamp and a MAC so the service can verify it statelessly
// on return without any storage.
//
// Format: <random16hex>.<timestamp_seconds>.<HMAC-SHA256(SECRET, random+"."+ts)>
// Validity window: 10 minutes (SERVICE_NONCE_TTL_SECONDS).
//
// Security note: a stolen nonce+presentation can be replayed within the 10-minute
// window. Mitigated by KB-JWT holder-key binding — only the original agent key can
// produce a valid presentation for a given nonce. Full double-spend prevention
// (seen-nonce cache) is deferred (see docs/decisions.md).

import crypto from 'crypto'

const TTL_SECONDS = 10 * 60

function getSecret(): Buffer {
  const s = process.env.SERVICE_NONCE_SECRET
  if (s) return Buffer.from(s, 'utf8')
  // Dev fallback — deterministic so nonces survive across serverless warm-ups in dev
  return Buffer.from('dev-nonce-secret-do-not-use-in-prod', 'utf8')
}

export function generateNonce(): string {
  const random = crypto.randomBytes(16).toString('hex')
  const ts = Math.floor(Date.now() / 1000).toString()
  const mac = crypto.createHmac('sha256', getSecret()).update(`${random}.${ts}`).digest('hex')
  return `${random}.${ts}.${mac}`
}

export function verifyNonce(nonce: string): boolean {
  const parts = nonce.split('.')
  if (parts.length !== 3) return false
  const [random, ts, mac] = parts
  const now = Math.floor(Date.now() / 1000)
  const issued = parseInt(ts, 10)
  if (isNaN(issued) || now - issued > TTL_SECONDS) return false
  const expected = crypto.createHmac('sha256', getSecret()).update(`${random}.${ts}`).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expected, 'hex'))
}
