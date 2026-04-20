import type { NextRequest } from 'next/server'

const facts = [
  'Honey never spoils — archaeologists have found 3,000-year-old honey in Egyptian tombs that was still edible.',
  'A day on Venus is longer than a year on Venus.',
  'Octopuses have three hearts and blue blood.',
  'The Eiffel Tower can be 15 cm taller during summer due to thermal expansion.',
  'Bananas are berries, but strawberries are not.',
  'A group of flamingos is called a flamboyance.',
  'The shortest war in history lasted 38 to 45 minutes — Britain vs. Zanzibar in 1896.',
  'Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid.',
  'Wombat droppings are cube-shaped.',
  'There are more possible iterations of a game of chess than atoms in the observable universe.',
]

function logRequestHeaders(request: NextRequest) {
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => { headers[key] = value })
  console.log('[funfact] request headers:', JSON.stringify(headers, null, 2))
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

  const countParam = request.nextUrl.searchParams.get('count')
  const count = Math.min(Math.max(parseInt(countParam ?? '1', 10) || 1, 1), 10)

  const shuffled = facts.slice().sort(() => Math.random() - 0.5)
  return Response.json({ facts: shuffled.slice(0, count) })
}
