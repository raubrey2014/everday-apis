import type { NextRequest } from 'next/server'
import { McpServer, WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { validateAttestationComponents } from '@/lib/attestation'

// Stateless: create a fresh server per request so tool closures can capture
// per-request attestation headers without shared mutable state.
export async function POST(request: NextRequest) {
  const components = {
    authenticator: request.headers.get('x-human-attestation'),
    prepared: request.headers.get('x-human-attestation-prepared'),
    keyId: request.headers.get('x-human-attestation-key-id'),
    issuerUrl: request.headers.get('x-human-attestation-issuer'),
  }

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
      description: 'Books a haircut at Machine Cuts in Boston. Requires a Privacy Pass attestation token supplied via X-Human-Attestation headers.',
      inputSchema: z.object({
        locationId: z.string().describe('Location ID from get_haircut_locations'),
        slotTime: z.string().describe('ISO 8601 time slot from get_haircut_locations'),
        name: z.string().describe("Customer's name"),
      }),
    },
    async ({ locationId, slotTime, name }) => {
      const valid = await validateAttestationComponents(components)
      if (!valid) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Booking failed: valid attestation token required. Ensure X-Human-Attestation headers are set when connecting to this MCP server.',
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

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  })

  await server.connect(transport)
  return transport.handleRequest(request)
}
