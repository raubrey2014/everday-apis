import { importJWK, compactDecrypt, calculateJwkThumbprint } from 'jose'

type RawJwk = Record<string, string>

function parsePrivateJwk(): RawJwk {
  const raw = process.env.SERVICE_ENCRYPTION_PRIVATE_KEY
  if (!raw) throw new Error('SERVICE_ENCRYPTION_PRIVATE_KEY env var not set')
  return JSON.parse(raw) as RawJwk
}

let _privateKey: Awaited<ReturnType<typeof importJWK>> | null = null
let _publicJwk: (RawJwk & { use: string; alg: string; kid: string }) | null = null

async function getPrivateKey(): Promise<Awaited<ReturnType<typeof importJWK>>> {
  if (_privateKey) return _privateKey
  _privateKey = await importJWK(parsePrivateJwk())
  return _privateKey
}

export async function getPublicEncryptionJwk() {
  if (_publicJwk) return _publicJwk
  const { d: _d, ...pub } = parsePrivateJwk()
  void _d
  const kid = await calculateJwkThumbprint(pub)
  _publicJwk = { ...pub, use: 'enc', alg: 'ECDH-ES+A256KW', kid }
  return _publicJwk
}

export async function decryptClaimsJwe(jwe: string): Promise<string> {
  const key = await getPrivateKey()
  const { plaintext } = await compactDecrypt(jwe, key)
  return new TextDecoder().decode(plaintext)
}
