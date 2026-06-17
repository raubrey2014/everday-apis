import type { NextRequest } from 'next/server'
import { validateAttestationToken } from '@/lib/attestation'
import { decryptAgentIdentityToken } from '@/lib/agent-identity'

export async function POST(request: NextRequest) {
  // Step 1: Privacy Pass attestation proves the caller is a legitimate agent.
  const attestationValid = await validateAttestationToken(request.headers.get('x-attestation-token'))
  if (!attestationValid) {
    return Response.json(
      { error: 'Valid attestation token required', hint: 'Obtain a Privacy Pass token from your identity provider' },
      { status: 401, headers: { 'WWW-Authenticate': 'PrivateToken realm="machine-cuts"' } },
    )
  }

  // Step 2: Agent identity token proves who the agent is (name + email).
  // The token is a JWE encrypted to Machine Cuts' public key at
  // /.well-known/agent-identity-keys (RSA-OAEP-256 + AES-256-GCM).
  const claims = decryptAgentIdentityToken(request.headers.get('x-agent-identity-token'))
  if (!claims) {
    return Response.json(
      {
        error: 'Valid agent identity token required',
        hint: 'Fetch the RSA public key from /.well-known/agent-identity-keys, encrypt {"name":"...","email":"..."} as a JWE (RSA-OAEP-256 + A256GCM), and pass the compact token in x-agent-identity-token',
      },
      {
        status: 401,
        headers: {
          'WWW-Authenticate': 'AgentIdentity realm="machine-cuts", keys-url="/.well-known/agent-identity-keys"',
        },
      },
    )
  }

  const body = await request.json() as { locationId?: string; slotTime?: string }
  if (!body.locationId || !body.slotTime) {
    return Response.json({ error: 'locationId and slotTime are required' }, { status: 400 })
  }

  const confirmationId = `MCUT-${Math.floor(100000 + Math.random() * 900000)}`
  return Response.json({
    confirmationId,
    location: 'Machine Cuts, 123 Newbury St, Boston, MA',
    appointmentTime: body.slotTime,
    name: claims.name,
    email: claims.email,
    message: 'Your appointment has been confirmed!',
  })
}
