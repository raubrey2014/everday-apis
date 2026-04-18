import type { NextRequest } from 'next/server'

const facts = [
  'Honey never spoils — archaeologists have found 3,000-year-old honey in Egyptian tombs that was still edible.',
  'A day on Venus is longer than a year on Venus.',
  'Octopuses have three hearts and blue blood.',
  'The Eiffel Tower can be 15 cm taller during summer due to thermal expansion.',
  'Bananas are berries, but strawberries are not.',
]

function checkApiKey(request: NextRequest): Response | null {
  const key = request.headers.get('x-api-key')
  if (!key || key !== process.env.PAYMENT_PROXY_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function GET(request: NextRequest) {
  const authError = checkApiKey(request)
  if (authError) return authError

  const fact = facts[Math.floor(Math.random() * facts.length)]
  return Response.json({ fact })
}
