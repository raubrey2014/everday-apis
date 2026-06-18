import { getPublicEncryptionJwk } from '@/lib/service-jwk'

export async function GET() {
  const key = await getPublicEncryptionJwk()
  return Response.json(
    { keys: [key] },
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  )
}
