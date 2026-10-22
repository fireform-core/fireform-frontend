import { useCallback, useEffect, useRef, useState } from 'react'
import { PenLine, Undo2, Eraser } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

interface SignatureModalProps {
  isOpen: boolean
  busy?: boolean
  error?: string | null
  onClose: () => void
  /** Called with the signature as a trimmed PNG data URL when the user confirms. */
  onSign: (signaturePng: string) => void
}

type Point = { x: number; y: number }

const INK_COLORS = [
  { name: 'Black', value: '#18181b' },
  { name: 'Blue', value: '#1d4ed8' },
] as const

// Canvas backing store is scaled for crisp strokes on high-DPI displays.
const PAD_WIDTH = 560
const PAD_HEIGHT = 200

export function SignatureModal({ isOpen, busy = false, error = null, onClose, onSign }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Strokes are kept so Undo can drop the most recent one and redraw the rest.
  const strokesRef = useRef<Point[][]>([])
  const activeStrokeRef = useRef<Point[] | null>(null)
  const [inkColor, setInkColor] = useState<string>(INK_COLORS[0].value)
  const [strokeCount, setStrokeCount] = useState(0)

  const inkColorRef = useRef(inkColor)
  inkColorRef.current = inkColor

  const getScale = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return 1
    const rect = canvas.getBoundingClientRect()
    return rect.width > 0 ? canvas.width / rect.width : 1
  }, [])

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Point[], color: string) => {
    if (stroke.length === 0) return
    ctx.strokeStyle = color
    ctx.lineWidth = 3 * (window.devicePixelRatio || 1)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    const [first, ...rest] = stroke
    ctx.moveTo(first.x, first.y)
    for (const p of rest) ctx.lineTo(p.x, p.y)
    // A single tap should still leave a dot.
    if (rest.length === 0) ctx.lineTo(first.x + 0.1, first.y + 0.1)
    ctx.stroke()
  }, [])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke, inkColorRef.current)
  }, [drawStroke])

  // Size the backing store once the modal is visible.
  useEffect(() => {
    if (!isOpen) return
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = PAD_WIDTH * dpr
    canvas.height = PAD_HEIGHT * dpr
    strokesRef.current = []
    activeStrokeRef.current = null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStrokeCount(0)
    const ctx = canvas.getContext('2d')
    ctx?.clearRect(0, 0, canvas.width, canvas.height)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, busy, onClose])

  function canvasPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const scale = getScale()
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (busy) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const point = canvasPoint(e)
    activeStrokeRef.current = [point]
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawStroke(ctx, activeStrokeRef.current, inkColorRef.current)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = activeStrokeRef.current
    if (!stroke) return
    const point = canvasPoint(e)
    const last = stroke[stroke.length - 1]
    // Skip duplicate points so taps don't stack zero-length segments.
    if (last.x === point.x && last.y === point.y) return
    stroke.push(point)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.strokeStyle = inkColorRef.current
      ctx.lineWidth = 3 * (window.devicePixelRatio || 1)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(last.x, last.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
    }
  }

  function handlePointerUp() {
    const stroke = activeStrokeRef.current
    activeStrokeRef.current = null
    if (stroke && stroke.length > 0) {
      strokesRef.current.push(stroke)
      setStrokeCount(strokesRef.current.length)
    }
  }

  function handleUndo() {
    if (busy) return
    strokesRef.current.pop()
    setStrokeCount(strokesRef.current.length)
    redraw()
  }

  function handleClear() {
    if (busy) return
    strokesRef.current = []
    setStrokeCount(0)
    redraw()
  }

  /** Crop transparent margins so the embedded signature sits tight on the page. */
  function exportTrimmedPng(): string | null {
    const canvas = canvasRef.current
    if (!canvas || strokesRef.current.length === 0) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const { width, height } = canvas
    const data = ctx.getImageData(0, 0, width, height).data
    let minX = width, minY = height, maxX = -1, maxY = -1
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 8) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) return null
    const pad = 10 * (window.devicePixelRatio || 1)
    minX = Math.max(0, Math.floor(minX - pad))
    minY = Math.max(0, Math.floor(minY - pad))
    maxX = Math.min(width - 1, Math.ceil(maxX + pad))
    maxY = Math.min(height - 1, Math.ceil(maxY + pad))
    const trimmed = document.createElement('canvas')
    trimmed.width = maxX - minX + 1
    trimmed.height = maxY - minY + 1
    trimmed.getContext('2d')?.drawImage(canvas, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height)
    return trimmed.toDataURL('image/png')
  }

  function handleSign() {
    if (busy) return
    const png = exportTrimmedPng()
    if (!png) return
    onSign(png)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4"
      onClick={e => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="w-full max-w-xl rounded-lg border border-zinc-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signature-dialog-title"
      >
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700"
              aria-hidden="true"
            >
              <PenLine className="w-5 h-5" />
            </span>
            <div>
              <h3 id="signature-dialog-title" className="text-sm font-semibold text-zinc-900">
                Sign PDF
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Draw your signature below. It will be placed at the bottom of the last page of the exported PDF.
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-zinc-300 bg-white">
            <canvas
              ref={canvasRef}
              className="block w-full cursor-crosshair touch-none select-none"
              style={{ height: PAD_HEIGHT, width: '100%' }}
              aria-label="Signature pad — draw your signature here"
              role="img"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Ink</span>
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Ink color">
                {INK_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={inkColor === c.value}
                    aria-label={`${c.name} ink`}
                    title={`${c.name} ink`}
                    disabled={busy}
                    onClick={() => setInkColor(c.value)}
                    className={cn(
                      'w-6 h-6 rounded-full border border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2',
                      inkColor === c.value && 'ring-2 ring-zinc-900 ring-offset-2'
                    )}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleUndo} disabled={busy || strokeCount === 0} className="text-xs">
                <Undo2 className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                Undo
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleClear} disabled={busy || strokeCount === 0} className="text-xs">
                <Eraser className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                Clear
              </Button>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="text-xs">
            Cancel
          </Button>
          <Button type="button" onClick={handleSign} disabled={busy || strokeCount === 0} className="text-xs">
            <PenLine className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            {busy ? 'Signing…' : 'Sign & Export PDF'}
          </Button>
        </div>
      </div>
    </div>
  )
}
