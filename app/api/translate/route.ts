import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const SYSTEM_PROMPT =
  'You are a professional translator. Translate the user-provided text to the requested target language. ' +
  'Respond with only the translated text — no explanations, no labels, no extra commentary.'

function logRequestHeaders(request: NextRequest) {
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => { headers[key] = value })
  console.log('[translate] request headers:', JSON.stringify(headers, null, 2))
}

function checkApiKey(request: NextRequest): Response | null {
  const key = request.headers.get('x-api-key')
  if (!key || key !== process.env.PAYMENT_PROXY_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function POST(request: NextRequest) {
  logRequestHeaders(request)
  const authError = checkApiKey(request)
  if (authError) return authError

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
  if (typeof targetLanguage !== 'string' || !targetLanguage.trim()) {
    return Response.json({ error: '`targetLanguage` is required' }, { status: 400 })
  }

  const stream = client.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Translate the following text to ${targetLanguage}:\n\n${text}`,
      },
    ],
  })

  const message = await stream.finalMessage()
  const translationBlock = message.content.find((b) => b.type === 'text')
  const translation = translationBlock?.type === 'text' ? translationBlock.text : ''

  return Response.json({ translation, targetLanguage })
}
