'use client'

import { useState, useEffect } from 'react'

interface Slot {
  time: string
  displayTime: string
}

interface Location {
  id: string
  name: string
  address: string
  availableSlots: Slot[]
}

interface Confirmation {
  confirmationId: string
  appointmentTime: string
  name: string
}

type BookingStep = 'idle' | 'captcha' | 'verifying' | 'booking' | 'confirmed'

function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function CaptchaModal({ step, onCheck }: { step: BookingStep; onCheck: () => void }) {
  const verified = step === 'verifying' || step === 'booking'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full max-w-xs">
        <div className="p-5">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
            Verify you&apos;re human
          </p>

          <button
            onClick={step === 'captcha' ? onCheck : undefined}
            disabled={verified}
            className="w-full flex items-center gap-3 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:pointer-events-none"
          >
            <div
              className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                verified
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-zinc-400 dark:border-zinc-500'
              }`}
            >
              {verified && <CheckIcon className="w-3.5 h-3.5 text-white" />}
            </div>
            <span className="text-sm text-zinc-700 dark:text-zinc-300">I&apos;m not a robot</span>
            <div className="ml-auto flex flex-col items-center gap-0.5 opacity-40">
              <div className="w-8 h-8 rounded border border-zinc-300 dark:border-zinc-600 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                  <path
                    d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
              <span className="text-[8px] text-zinc-400 dark:text-zinc-500">Privacy Pass</span>
            </div>
          </button>

          <div className="mt-4 min-h-[32px] flex items-center justify-center gap-2">
            {step === 'verifying' && (
              <>
                <Spinner />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Issuing attestation token…</p>
              </>
            )}
            {step === 'booking' && (
              <>
                <Spinner />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Booking your appointment…</p>
              </>
            )}
            {step === 'captcha' && (
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                Completing this generates a Privacy Pass attestation token
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-3">
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Agents that skip this step cannot obtain an attestation token and are
            blocked at the API layer. Agents with attestation can book via{' '}
            <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">POST /mcp</code>.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loadingLocations, setLoadingLocations] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [name, setName] = useState('')
  const [step, setStep] = useState<BookingStep>('idle')
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  useEffect(() => {
    fetch('/api/haircut/locations')
      .then(r => r.json())
      .then((data: { locations: Location[] }) => {
        setLocations(data.locations)
        setLoadingLocations(false)
      })
  }, [])

  const handleBookClick = () => {
    if (!selectedSlot || !name.trim()) return
    setStep('captcha')
  }

  const handleCaptchaCheck = async () => {
    setStep('verifying')
    await delay(1400)
    setStep('booking')
    await delay(900)
    setConfirmation({
      confirmationId: `MCUT-${Math.floor(100000 + Math.random() * 900000)}`,
      appointmentTime: selectedSlot!.time,
      name: name.trim() || 'Guest',
    })
    setStep('confirmed')
  }

  const handleReset = () => {
    setStep('idle')
    setSelectedSlot(null)
    setName('')
    setConfirmation(null)
  }

  const location = locations[0]
  const dateStr = location?.availableSlots[0]?.time.slice(0, 10)
  const formattedDate = dateStr
    ? new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : ''

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      <main className="mx-auto max-w-xl px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-base">
              <span className="text-zinc-50 dark:text-zinc-900">✂</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Machine Cuts
            </h1>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Boston&apos;s freshest cuts. Book a slot below — human verification required.
          </p>
        </div>

        {/* Why attestation callout */}
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 p-4">
          <div className="flex gap-2.5">
            <span className="text-amber-500 mt-0.5 text-sm flex-shrink-0">⚡</span>
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">
                Why CAPTCHA for an API?
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                AI agents can discover and call this API directly — but booking requires an
                attestation token proving a human completed verification. Agents that can&apos;t
                obtain one get blocked at the API layer, not the UI layer.
              </p>
            </div>
          </div>
        </div>

        {/* Booking card */}
        {loadingLocations ? (
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 animate-pulse">
            <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-2/5 mb-2" />
            <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-3/5 mb-8" />
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-9 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
              ))}
            </div>
          </div>
        ) : location ? (
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6">
            {/* Location header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{location.name}</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{location.address}</p>
              </div>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs px-2.5 py-1 font-medium flex-shrink-0">
                Open tomorrow
              </span>
            </div>

            {/* Date heading */}
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3">
              {formattedDate}
            </p>

            {/* Time slots */}
            <div className="flex flex-wrap gap-2 mb-6">
              {location.availableSlots.map(slot => {
                const selected = selectedSlot?.time === slot.time
                return (
                  <button
                    key={slot.time}
                    onClick={() => step === 'idle' && setSelectedSlot(slot)}
                    disabled={step !== 'idle'}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-default ${
                      selected
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                        : 'border-zinc-200 text-zinc-700 hover:border-zinc-400 disabled:hover:border-zinc-200 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:disabled:hover:border-zinc-700'
                    }`}
                  >
                    {slot.displayTime}
                  </button>
                )
              })}
            </div>

            {/* Name input */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                Your name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Alex Smith"
                disabled={step !== 'idle'}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
              />
            </div>

            {/* Confirmation or Book button */}
            {step === 'confirmed' && confirmation ? (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm">
                      Appointment confirmed!
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                      {confirmation.confirmationId} &middot; {confirmation.name}
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      {selectedSlot?.displayTime} &middot; Machine Cuts, 123 Newbury St
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs text-emerald-700 dark:text-emerald-400 underline underline-offset-2"
                >
                  Book another
                </button>
              </div>
            ) : (
              <button
                onClick={handleBookClick}
                disabled={!selectedSlot || !name.trim() || step !== 'idle'}
                className="w-full rounded-lg bg-zinc-900 text-white py-2.5 text-sm font-medium hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {selectedSlot ? `Book ${selectedSlot.displayTime} →` : 'Select a time slot'}
              </button>
            )}
          </div>
        ) : null}

        {/* Agent perspective */}
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5">
          <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3">
            Booking as an agent
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            Agents can book natively via the MCP server at{' '}
            <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-700 dark:text-zinc-300">
              POST /mcp
            </code>{' '}
            using the{' '}
            <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-700 dark:text-zinc-300">
              book_haircut_appointment
            </code>{' '}
            tool. Booking still requires an attestation token — without one, the tool returns an error:
          </p>
          <pre className="text-xs bg-zinc-950 text-zinc-300 rounded-lg p-4 overflow-x-auto leading-relaxed">{`{
  "isError": true,
  "content": "Booking failed: valid attestation
              token required. Ensure attestation
              headers are set when connecting."
}`}</pre>
        </div>
      </main>

      {(step === 'captcha' || step === 'verifying' || step === 'booking') && (
        <CaptchaModal step={step} onCheck={handleCaptchaCheck} />
      )}
    </div>
  )
}
