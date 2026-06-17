import type { NextRequest } from 'next/server'

// This endpoint was part of the pre-spec JWE identity token scheme and has been
// removed. Identity claims are now disclosed via the AAP spec Identity-Presentation
// flow — see app/api/haircut/book-agent-identity/route.ts and lib/sd-jwt-verify.ts.
export async function POST(_request: NextRequest) {
  return Response.json(
    {
      error: 'This endpoint has been removed.',
      hint: 'Identity claims are now disclosed via the urn:aap:claims-required challenge flow. See /api/haircut/book-agent-identity.',
    },
    { status: 410 },
  )
}
