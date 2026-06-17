import { getPublicKeyJwkSet } from '@/lib/agent-identity'

// Serves Machine Cuts' RSA public key so agent issuers can encrypt identity
// claims (name, email) that only this service can decrypt (JWE RSA-OAEP-256).
export function GET() {
  return Response.json(getPublicKeyJwkSet(), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
