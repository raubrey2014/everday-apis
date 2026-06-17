import type { NextRequest } from 'next/server'
import { createAgentIdentityToken } from '@/lib/agent-identity'

// Demo helper: creates a signed agent identity JWE token for a given name/email.
// In production this would be issued by an identity provider that has fetched
// the public key from /.well-known/agent-identity-keys.
export async function POST(request: NextRequest) {
  const body = await request.json() as { name?: unknown; email?: unknown }
  if (typeof body.name !== 'string' || typeof body.email !== 'string' || !body.name || !body.email) {
    return Response.json({ error: 'name and email are required' }, { status: 400 })
  }

  const token = createAgentIdentityToken({ name: body.name, email: body.email })
  return Response.json({ token, hint: 'Pass this in the x-agent-identity-token header when calling /api/haircut/book-agent-identity or the MCP book_haircut_appointment_with_identity tool' })
}
