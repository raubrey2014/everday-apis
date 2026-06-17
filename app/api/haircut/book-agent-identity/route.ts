import type { NextRequest } from 'next/server'
import { validateAttestationToken } from '@/lib/attestation'
import { verifyIdentityPresentation } from '@/lib/sd-jwt-verify'
import { generateNonce, verifyNonce } from '@/lib/challenge-nonce'

const SERVICE_AUD = process.env.SERVICE_AUD ?? 'https://everyday-apis.vercel.app'

export async function POST(request: NextRequest) {
  // Step 1: Privacy Pass attestation
  const attestationValid = await validateAttestationToken(request.headers.get('authorization'))
  if (!attestationValid) {
    return Response.json(
      { error: 'Valid attestation token required', hint: 'Obtain a Privacy Pass token from your identity provider' },
      { status: 401, headers: { 'WWW-Authenticate': 'PrivateToken realm="machine-cuts"' } },
    )
  }

  // Step 2: Identity presentation — issue a challenge if absent
  const identityPresentation = request.headers.get('identity-presentation')
  if (!identityPresentation) {
    const nonce = generateNonce()
    return Response.json(
      {
        type: 'urn:aap:claims-required',
        aud: SERVICE_AUD,
        nonce,
        claims: ['name', 'email'],
        purpose: 'Personalise your haircut appointment confirmation',
        formats: ['dc+sd-jwt', 'aap-claims+jwt'],
        trusted_issuers: [process.env.ATTESTATION_ISSUER_URL ?? ''],
      },
      {
        status: 401,
        headers: { 'WWW-Authenticate': 'Identity-Presentation realm="machine-cuts"' },
      },
    )
  }

  // Verify the nonce embedded in the request body (agent echoes it back)
  const body = await request.json() as { locationId?: string; slotTime?: string; nonce?: string }
  if (!body.nonce || !verifyNonce(body.nonce)) {
    return Response.json(
      { error: 'Missing or expired nonce. Re-request the challenge to get a fresh one.' },
      { status: 401 },
    )
  }

  // Verify the identity presentation
  const claims = await verifyIdentityPresentation(identityPresentation, { aud: SERVICE_AUD, nonce: body.nonce })
  if (!claims) {
    return Response.json(
      {
        error: 'Identity-Presentation verification failed',
        hint: 'Present a valid SD-JWT-VC or aap-claims+jwt, bound to this service and nonce',
      },
      { status: 401 },
    )
  }

  if (!body.locationId || !body.slotTime) {
    return Response.json({ error: 'locationId and slotTime are required' }, { status: 400 })
  }

  const confirmationId = `MCUT-${Math.floor(100000 + Math.random() * 900000)}`
  return Response.json({
    confirmationId,
    location: 'Machine Cuts, 123 Newbury St, Boston, MA',
    appointmentTime: body.slotTime,
    name: claims.name ?? 'Guest',
    email: claims.email ?? '(not provided)',
    message: 'Your appointment has been confirmed!',
  })
}
