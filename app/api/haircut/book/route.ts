import type { NextRequest } from 'next/server'
import { validateAttestationToken } from '@/lib/attestation'

function logRequestHeaders(request: NextRequest) {
  const headers: Record<string, string> = {}
  request.headers.forEach((value: string, key: string) => { headers[key] = value })
  console.log('[haircut/book] request headers:', JSON.stringify(headers, null, 2))
}

export async function POST(request: NextRequest) {
  logRequestHeaders(request)

  const valid = await validateAttestationToken(request.headers.get('x-attestation-token'))
  if (!valid) {
    return Response.json(
      { error: 'Valid attestation token required', hint: 'Obtain a Privacy Pass token from your identity provider' },
      { status: 401 },
    )
  }

  const body = await request.json() as { locationId?: string; slotTime?: string; name?: string }
  if (!body.locationId || !body.slotTime) {
    return Response.json({ error: 'locationId and slotTime are required' }, { status: 400 })
  }

  const confirmationId = `MCUT-${Math.floor(100000 + Math.random() * 900000)}`

  return Response.json({
    confirmationId,
    location: 'Machine Cuts, 123 Newbury St, Boston, MA',
    appointmentTime: body.slotTime,
    name: body.name ?? 'Guest',
    message: 'Your appointment has been confirmed!',
  })
}
