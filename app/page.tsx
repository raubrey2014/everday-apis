const apis = [
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
            Everyday APIs
          </h1>
          <p className="mt-3 text-zinc-500 dark:text-zinc-400">
            A small collection of simple, useful API endpoints. All requests require an{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-sm dark:bg-zinc-800">x-api-key</code>{' '}
            header.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {apis.map((api) => (
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
              <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                Params: {api.params}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-zinc-400 dark:text-zinc-600">
          Each endpoint has a corresponding <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">/quote</code> route for pricing and validation.
        </p>
      </main>
    </div>
  )
}
