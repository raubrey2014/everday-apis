import type { NextRequest } from 'next/server'
import { McpServer, WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { validateAttestationToken } from '@/lib/attestation'
import { verifyIdentityPresentation } from '@/lib/sd-jwt-verify'
import { generateNonce, verifyNonce } from '@/lib/challenge-nonce'

const SERVICE_AUD = process.env.SERVICE_AUD ?? 'https://everyday-apis.vercel.app'

// Stateless: create a fresh server per request so tool closures can capture
// per-request headers without shared mutable state.
export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization')
  const signatureInput = request.headers.get('signature-input')
  const signature = request.headers.get('signature')
  const agentKey = request.headers.get('agent-key')
  const identityPresentation = request.headers.get('identity-presentation')

  let toolName: string | undefined
  try {
    const body = await request.clone().json() as { method?: string; params?: { name?: string } }
    if (body.method === 'tools/call') toolName = body.params?.name
  } catch { /* not a JSON-RPC tool call */ }

  console.log('[mcp] incoming request headers:', toolName ? `(tool: ${toolName})` : '')
  console.log('  authorization:           ', authorization ?? '(none)')
  console.log('  signature-input:         ', signatureInput ?? '(none)')
  console.log('  signature:               ', signature ?? '(none)')
  console.log('  agent-key:               ', agentKey ?? '(none)')
  console.log('  identity-presentation:   ', identityPresentation ? '(present)' : '(none)')

  const server = new McpServer({ name: 'machine-cuts', version: '1.0.0' })

  server.registerTool(
    'get_haircut_locations',
    {
      title: 'Get Haircut Locations',
      description: 'Returns the Boston location with available appointment slots for tomorrow.',
      inputSchema: z.object({}),
    },
    async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateStr = tomorrow.toISOString().slice(0, 10)

      const slots = [
        { hour: 9,  minute: 0,  displayTime: '9:00 AM'  },
        { hour: 11, minute: 30, displayTime: '11:30 AM' },
        { hour: 14, minute: 0,  displayTime: '2:00 PM'  },
        { hour: 16, minute: 30, displayTime: '4:30 PM'  },
      ].map(({ hour, minute, displayTime }) => ({
        time: `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
        displayTime,
      }))

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            locations: [{
              id: 'boston-newbury',
              name: 'Machine Cuts',
              address: '123 Newbury St, Boston, MA 02116',
              availableSlots: slots,
            }],
          }, null, 2),
        }],
      }
    },
  )

  server.registerTool(
    'book_haircut_appointment',
    {
      title: 'Book Haircut Appointment',
      description: 'Books a haircut at Machine Cuts in Boston. Requires a Privacy Pass attestation token in the Authorization: PrivateToken header.',
      inputSchema: z.object({
        locationId: z.string().describe('Location ID from get_haircut_locations'),
        slotTime: z.string().describe('ISO 8601 time slot from get_haircut_locations'),
        name: z.string().describe("Customer's name"),
      }),
    },
    async ({ locationId, slotTime, name }) => {
      console.log('[mcp] book_haircut_appointment called, validating attestation token')
      const valid = await validateAttestationToken(authorization)
      console.log('[mcp] attestation valid:', valid)
      if (!valid) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Booking failed: valid attestation token required. Ensure Authorization: PrivateToken token=<...> is set when connecting to this MCP server.',
          }],
          isError: true,
        }
      }

      if (!locationId || !slotTime) {
        return {
          content: [{ type: 'text' as const, text: 'Booking failed: locationId and slotTime are required.' }],
          isError: true,
        }
      }

      const confirmationId = `MCUT-${Math.floor(100000 + Math.random() * 900000)}`
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            confirmationId,
            location: 'Machine Cuts, 123 Newbury St, Boston, MA',
            appointmentTime: slotTime,
            name: name ?? 'Guest',
            message: 'Your appointment has been confirmed!',
          }, null, 2),
        }],
      }
    },
  )

  server.registerTool(
    'book_haircut_appointment_with_identity',
    {
      title: 'Book Haircut Appointment (Verified Identity)',
      description: [
        'Books a haircut at Machine Cuts requiring two things:',
        '1. Privacy Pass attestation (Authorization: PrivateToken) — proves the caller is a legitimate agent.',
        '2. Identity presentation (Identity-Presentation header) — verified name and email from the agent\'s Identity Provider.',
        'If the Identity-Presentation header is absent, the tool returns a urn:aap:claims-required challenge.',
        'The agent must call the IDP claims endpoint with the challenge, then retry with the resulting token.',
      ].join(' '),
      inputSchema: z.object({
        locationId: z.string().describe('Location ID from get_haircut_locations'),
        slotTime: z.string().describe('ISO 8601 time slot from get_haircut_locations'),
        // nonce is passed back by the agent on retry so the service can verify it
        nonce: z.string().optional().describe('Nonce from the urn:aap:claims-required challenge (required on retry)'),
        // identity_presentation can be passed as a parameter when injecting it as a
        // per-call HTTP header is not possible (e.g. when called via MCPClient)
        identity_presentation: z.string().optional().describe('Identity presentation token from resolveIdentityClaims (SD-JWT-VC or aap-claims+jwt)'),
      }),
    },
    async ({ locationId, slotTime, nonce, identity_presentation }) => {
      // Accept identity presentation from either the HTTP header or the tool parameter
      const effectivePresentation = identityPresentation ?? identity_presentation ?? null
      // Step 1: Privacy Pass attestation
      const attestationValid = await validateAttestationToken(authorization)
      if (!attestationValid) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Booking failed: valid Privacy Pass attestation token required.',
          }],
          isError: true,
        }
      }

      // Step 2: Identity presentation
      if (!effectivePresentation) {
        // Issue a fresh nonce and challenge the agent
        const freshNonce = generateNonce()
        const challenge = {
          type: 'urn:aap:claims-required',
          aud: SERVICE_AUD,
          nonce: freshNonce,
          claims: ['name', 'email'],
          purpose: 'Personalise your haircut appointment confirmation',
          formats: ['dc+sd-jwt', 'aap-claims+jwt'],
          trusted_issuers: [process.env.ATTESTATION_ISSUER_URL ?? ''],
        }
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(challenge, null, 2),
          }],
          isError: true,
        }
      }

      // Verify the nonce passed back by the agent matches a valid challenge
      if (!nonce || !verifyNonce(nonce)) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'Missing or expired nonce. Re-fetch the challenge by calling this tool without Identity-Presentation.',
            }),
          }],
          isError: true,
        }
      }

      // Verify the identity presentation
      const claims = await verifyIdentityPresentation(effectivePresentation, { aud: SERVICE_AUD, nonce })
      if (!claims) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Booking failed: Identity-Presentation could not be verified. Ensure the token is a valid SD-JWT-VC or aap-claims+jwt, bound to this service and nonce.',
          }],
          isError: true,
        }
      }

      if (!locationId || !slotTime) {
        return {
          content: [{ type: 'text' as const, text: 'Booking failed: locationId and slotTime are required.' }],
          isError: true,
        }
      }

      const confirmationId = `MCUT-${Math.floor(100000 + Math.random() * 900000)}`
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            confirmationId,
            location: 'Machine Cuts, 123 Newbury St, Boston, MA',
            appointmentTime: slotTime,
            name: claims.name ?? 'Guest',
            email: claims.email ?? '(not provided)',
            message: 'Your appointment has been confirmed!',
          }, null, 2),
        }],
      }
    },
  )

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  })

  await server.connect(transport)
  return transport.handleRequest(request)
}
