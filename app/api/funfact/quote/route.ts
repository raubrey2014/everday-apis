import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const countParam = request.nextUrl.searchParams.get('count')
  const count = parseInt(countParam ?? '1', 10)

  if (isNaN(count) || count < 1) {
    return Response.json({ error: '`count` must be a positive integer' }, { status: 400 })
  }
  if (count > 10) {
    return Response.json({ error: '`count` cannot exceed 10' }, { status: 400 })
  }

  return Response.json({ amount: count, currency: 'USDC', decimals: 2 })
}
