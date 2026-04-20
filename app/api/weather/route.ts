import type { NextRequest } from 'next/server'

function logRequestHeaders(request: NextRequest) {
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => { headers[key] = value })
  console.log('[weather] request headers:', JSON.stringify(headers, null, 2))
}

function checkApiKey(request: NextRequest): Response | null {
  const key = request.headers.get('x-api-key')
  if (!key || key !== process.env.PAYMENT_PROXY_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function GET(request: NextRequest) {
  logRequestHeaders(request)
  const authError = checkApiKey(request)
  if (authError) return authError

  return Response.json({
    location: 'San Francisco, CA',
    temperature: 62,
    unit: 'F',
    condition: 'Partly cloudy',
    humidity: '72%',
  })
}
