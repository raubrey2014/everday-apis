export async function GET() {
  return Response.json({ amount: 1, currency: 'USDC', decimals: 2 })
}
