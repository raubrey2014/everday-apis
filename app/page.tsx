const haircutApis = [
  {
    name: 'Locations & Availability',
    method: 'GET',
    path: '/api/haircut/locations',
    description: 'Returns the Boston location with available appointment slots for tomorrow.',
    params: 'none',
    gated: false,
  },
  {
    name: 'Book Appointment',
    method: 'POST',
    path: '/api/haircut/book',
    description: 'Books a haircut appointment. Requires a Privacy Pass attestation token.',
    params: 'locationId, slotTime, name',
    gated: true,
  },
]

const otherApis = [
  {
    name: 'Fun Fact',
    method: 'GET',
    path: '/api/funfact',
    description: 'Returns one or more random fun facts.',
    params: 'count (1–10)',
  },
  {
    name: 'Translate',
    method: 'POST',
    path: '/api/translate',
    description: 'Translates text into a target language using Claude.',
    params: 'text, targetLanguage',
  },
  {
    name: 'Weather',
    method: 'GET',
    path: '/api/weather',
    description: 'Returns current weather conditions for San Francisco.',
    params: 'none',
  },
]

const methodColor: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
}

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      <main className="mx-auto max-w-2xl px-6 py-20">
        <div className="mb-12">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Machine Cuts
          </h1>
          <p className="mt-3 text-zinc-500 dark:text-zinc-400">
            Book a haircut at our Boston location. Booking requires a{' '}
            <a
              href="https://privacypass.github.io"
              className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700 dark:decoration-zinc-600 dark:hover:text-zinc-200"
            >
              Privacy Pass
            </a>{' '}
            attestation token — proof that a human approved this request.
          </p>
        </div>

        <div className="flex flex-col gap-4 mb-12">
          {haircutApis.map((api) => (
            <div
              key={api.path}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-2.5 mb-2">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${methodColor[api.method]}`}>
                  {api.method}
                </span>
                <code className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{api.path}</code>
                {api.gated && (
                  <span className="rounded px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400">
                    attestation
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{api.description}</p>
              <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">Params: {api.params}</p>
              {api.gated && (
                <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                  Header:{' '}
                  <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">X-Attestation-Token</code>
                </p>
              )}
            </div>
          ))}
        </div>

        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-4">
          Other endpoints
        </h2>
        <div className="flex flex-col gap-4">
          {otherApis.map((api) => (
            <div
              key={api.path}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-2.5 mb-2">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${methodColor[api.method]}`}>
                  {api.method}
                </span>
                <code className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{api.path}</code>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{api.description}</p>
              <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">Params: {api.params}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-zinc-400 dark:text-zinc-600">
          Other endpoints require an{' '}
          <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">x-api-key</code>{' '}
          header. Each has a corresponding{' '}
          <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">/quote</code>{' '}
          route for pricing.
        </p>
      </main>
    </div>
  )
}
