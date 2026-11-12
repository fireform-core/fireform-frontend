import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, Flame } from 'lucide-react'

type Step = { label: string; detail: string; doneAfter: number }

const STEPS: Step[] = [
  {
    label: 'Starting local backend',
    detail: 'Launching FireForm API on 127.0.0.1:8000',
    doneAfter: 2000,
  },
  {
    label: 'Initialising database',
    detail: 'Setting up SQLite and running migrations',
    doneAfter: 4500,
  },
  {
    label: 'Connecting to Ollama',
    detail: 'Checking local AI inference service',
    doneAfter: 7500,
  },
]

export function LoadingScreen() {
  const [elapsed, setElapsed] = useState(0)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setElapsed(e => e + 500), 500)
    const slowTimer = setTimeout(() => setSlow(true), 14000)
    return () => {
      clearInterval(interval)
      clearTimeout(slowTimer)
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-zinc-50 font-sans select-none gap-6">
      {/* Logo mark */}
      <div className="w-11 h-11 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-md">
        <Flame className="w-5 h-5 text-amber-400" />
      </div>

      {/* Title */}
      <div className="text-center">
        <h1 className="text-base font-bold text-zinc-900">Setting up FireForm</h1>
        <p className="text-xs text-zinc-500 mt-1">Starting local services — this only takes a moment</p>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-2 w-72">
        {STEPS.map((step, i) => {
          const done = elapsed > step.doneAfter
          const prevDone = i === 0 || elapsed > STEPS[i - 1].doneAfter
          const active = !done && prevDone

          return (
            <div
              key={i}
              className={[
                'flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-xs transition-all duration-300',
                done
                  ? 'text-zinc-400'
                  : active
                    ? 'text-zinc-900 bg-white border border-zinc-200 shadow-sm'
                    : 'text-zinc-300',
              ].join(' ')}
            >
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-px shrink-0" />
              ) : active ? (
                <Loader2 className="w-4 h-4 animate-spin mt-px shrink-0 text-zinc-400" />
              ) : (
                <div className="w-4 h-4 mt-px shrink-0 rounded-full border border-zinc-200" />
              )}
              <div>
                <div className="font-semibold leading-snug">{step.label}</div>
                <div className="text-zinc-400 mt-0.5">{step.detail}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Slow warning */}
      {slow && (
        <div className="max-w-xs px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs text-center leading-relaxed">
          Taking longer than expected. If you're using Docker, run{' '}
          <span className="font-mono">make fireform</span>. For the desktop app,
          check that the binary started successfully.
        </div>
      )}
    </div>
  )
}
