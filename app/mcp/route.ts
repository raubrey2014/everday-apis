import type { NextRequest } from 'next/server'
import { McpServer, WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { validateAttestationToken } from '@/lib/attestation'
import { decryptAgentIdentityToken } from '@/lib/agent-identity'

// Stateless: create a fresh server per request so tool closures can capture
// per-request attestation headers without shared mutable state.
export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization')
  const signatureInput = request.headers.get('signature-input')
  const signature = request.headers.get('signature')
  const agentKey = request.headers.get('agent-key')
  const agentIdentityToken = request.headers.get('x-agent-identity-token')

  console.log('[mcp] incoming request headers:')
  console.log('  authorization:          ', authorization ?? '(none)')
  console.log('  signature-input:        ', signatureInput ?? '(none)')
  console.log('  signature:              ', signature ?? '(none)')
  console.log('  agent-key:              ', agentKey ?? '(none)')
  console.log('  x-agent-identity-token: ', agentIdentityToken ? '(present)' : '(none)')

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
      title: 'Book Haircut Appointment (Agent Identity)',
      description: [
        'Books a haircut at Machine Cuts requiring two tokens:',
        '1. Privacy Pass attestation in Authorization: PrivateToken header (proves the caller is a legitimate agent)',
        '2. Agent identity JWE in x-agent-identity-token header (proves who the agent is)',
        'To create the identity token: fetch the RSA public key from /.well-known/agent-identity-keys,',
        'then encrypt {"name":"...","email":"..."} as a JWE compact token (RSA-OAEP-256 + A256GCM).',
        'A demo token can be minted via POST /api/haircut/agent-identity-token.',
      ].join(' '),
      inputSchema: z.object({
        locationId: z.string().describe('Location ID from get_haircut_locations'),
        slotTime: z.string().describe('ISO 8601 time slot from get_haircut_locations'),
      }),
    },
    async ({ locationId, slotTime }) => {
      const attestationValid = await validateAttestationToken(authorization)
      if (!attestationValid) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Booking failed: valid Privacy Pass attestation token required. Set Authorization: PrivateToken token=<...> when connecting to this MCP server.',
          }],
          isError: true,
        }
      }

      const claims = decryptAgentIdentityToken(agentIdentityToken)
      if (!claims) {
        return {
          content: [{
            type: 'text' as const,
            text: [
              'Booking failed: valid agent identity token required.',
              'Fetch the RSA-OAEP-256 public key from /.well-known/agent-identity-keys,',
              'encrypt {"name":"...","email":"..."} as a JWE compact token (alg: RSA-OAEP-256, enc: A256GCM),',
              'and pass it in the x-agent-identity-token header.',
              'For a demo token call POST /api/haircut/agent-identity-token with {"name":"...","email":"..."}.',
            ].join(' '),
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
            name: claims.name,
            email: claims.email,
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
