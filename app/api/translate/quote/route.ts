import type { NextRequest } from 'next/server'

// Non-Latin-script languages that cost more to translate
const PREMIUM_LANGUAGES = new Set([
  'japanese', 'chinese', 'chinese simplified', 'chinese traditional',
  'mandarin', 'cantonese', 'korean', 'arabic', 'hebrew', 'thai',
  'hindi', 'urdu', 'persian', 'farsi', 'georgian', 'armenian', 'amharic',
])

function isPremium(targetLanguage: string): boolean {
  return PREMIUM_LANGUAGES.has(targetLanguage.toLowerCase().trim())
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { text, targetLanguage } = body as Record<string, unknown>

  if (typeof text !== 'string' || !text.trim()) {
    return Response.json({ error: '`text` is required' }, { status: 400 })
  }
  if (text.length > 5000) {
    return Response.json({ error: '`text` cannot exceed 5000 characters' }, { status: 400 })
  }
  if (typeof targetLanguage !== 'string' || !targetLanguage.trim()) {
    return Response.json({ error: '`targetLanguage` is required' }, { status: 400 })
  }

  const amount = isPremium(targetLanguage) ? 10 : 5

  return Response.json({ amount, currency: 'USDC', decimals: 2 })
}
