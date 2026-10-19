import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

export function LoadingScreen() {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 5000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen gap-3 bg-zinc-50 text-zinc-950 font-sans select-none">
      <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
      <h2 className="text-sm font-semibold text-zinc-900">Starting up...</h2>
      <p className="text-xs text-zinc-500">Initializing FireForm backend</p>
      {slow && (
        <div className="mt-2 max-w-sm px-3 py-2 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-xs text-center">
          The backend isn't reachable at <span className="font-mono">127.0.0.1:8000</span> yet. Start it
          with <span className="font-mono">make fireform</span>; this screen keeps retrying.
        </div>
      )}
    </div>
  )
}
