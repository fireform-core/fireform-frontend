import { useState, useEffect, useRef } from 'react'
import {
  FileText,
  ExternalLink,
  Eye,
  Upload,
  Loader2,
  Layers,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { resolvePreviewUrl } from '../../lib/api'
import { cn, withPdfViewerParams } from '../../lib/utils'
import type { Template } from '../../types'

interface DocumentViewerProps {
  template: Template | null
  fields: Array<{ name: string; type: string; key?: string }>
  pdfPath?: string | null
  filledPdfPath?: string | null
  onFileSelect?: (file: File) => void
  isFilling?: boolean
  lastFillTime?: number
}

export function DocumentViewer({
  template,
  fields,
  pdfPath,
  filledPdfPath = null,
  onFileSelect,
  isFilling = false,
  lastFillTime = 0,
}: DocumentViewerProps) {
  const [blankUrl, setBlankUrl] = useState<string>('')
  const [filledUrl, setFilledUrl] = useState<string>('')
  const [frameUrl, setFrameUrl] = useState<string>('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const activeBlobUrlRef = useRef<string | null>(null)

  // Transition & Animation state
  const [displayMode, setDisplayMode] = useState<'filled' | 'blank'>('blank')
  const [isFadingInFilled, setIsFadingInFilled] = useState(false)

  // Fill animation preference lives in Settings (localStorage key
  // 'ff-animations', read at fill time so a Settings change applies
  // without a reload).
  const [filledFadeReady, setFilledFadeReady] = useState(false)
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const readAnimationsEnabled = () => {
    if (typeof window === 'undefined') return true
    try {
      return window.localStorage.getItem('ff-animations') !== 'off'
    } catch {
      return true
    }
  }

  const prevLastFillTimeRef = useRef<number>(0)

  const templateName = template?.name || (pdfPath ? pdfPath.split('/').pop() : 'Document Preview')
  const totalFields = fields.length

  // Resolve blank template URL
  useEffect(() => {
    const rawTemplatePath = template?.pdf_path
    if (rawTemplatePath && rawTemplatePath.trim()) {
      resolvePreviewUrl(rawTemplatePath.trim()).then(url => {
        if (url) setBlankUrl(url)
      }).catch(() => {})
    }
  }, [template?.pdf_path])

  // Resolve current active pdfPath
  const loadPdf = async (path: string) => {
    setLoadError(null)
    try {
      const url = await resolvePreviewUrl(path)
      if (url) {
        setFrameUrl(url)
        // A path counts as filled only if it is the actual filled output
        // Studio recorded — never merely "anything that isn't the template".
        // (Uploading a blank PDF used to be misread as a filled one.)
        const isFilled = filledPdfPath
          ? path.trim() === filledPdfPath.trim()
          : template?.pdf_path
            ? path.trim() !== template.pdf_path.trim()
            : path.includes('filled')
        if (isFilled) {
          setFilledUrl(url)
          setDisplayMode('filled')
        } else {
          setBlankUrl(url)
          setFilledUrl('')
          setDisplayMode('blank')
        }
      } else {
        // Drop the previous document so a failed load can't leave a stale PDF on screen
        setFrameUrl('')
        setLoadError(`Unable to preview PDF at path "${path}".`)
      }
    } catch (err: any) {
      setFrameUrl('')
      setLoadError(err?.message || 'Error loading PDF preview.')
    }
  }

  useEffect(() => {
    if (pdfPath && pdfPath.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadPdf(pdfPath.trim())
    } else {
      setFrameUrl('')
      setFilledUrl('')
      setLoadError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfPath])

  // On a successful fill, fade the filled PDF in with the glow — unless
  // animations are off (Settings) or the OS asks for reduced motion, in
  // which case the filled PDF just appears at once (reduced-motion covers
  // the JS parts too, not only the CSS).
  // The fade needs two frames: the filled layer must first paint at
  // opacity 0, otherwise it mounts already visible and no crossfade plays.
  useEffect(() => {
    if (lastFillTime > 0 && lastFillTime !== prevLastFillTimeRef.current) {
      prevLastFillTimeRef.current = lastFillTime
      setDisplayMode('filled')
      const animate = readAnimationsEnabled() && !prefersReducedMotion
      setIsFadingInFilled(animate)
      if (animate) {
        setFilledFadeReady(false)
        requestAnimationFrame(() => requestAnimationFrame(() => setFilledFadeReady(true)))
      } else {
        setFilledFadeReady(true)
      }
    }
  }, [lastFillTime, prefersReducedMotion])



  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current)
    }
    const blobUrl = URL.createObjectURL(file)
    activeBlobUrlRef.current = blobUrl
    setFrameUrl(blobUrl)
    setBlankUrl(blobUrl)
    setFilledUrl('')
    setLoadError(null)

    if (onFileSelect) {
      onFileSelect(file)
    }
  }

  const isFilledAvailable = Boolean(filledUrl && filledUrl !== blankUrl)

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-100 overflow-hidden border-r border-zinc-200 font-sans">
      {/* Top Document Toolbar */}
      <div className="h-11 bg-white border-b border-zinc-200 px-4 flex items-center justify-between select-none flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-zinc-900 truncate">
            <FileText className="w-4 h-4 text-zinc-700 flex-shrink-0" />
            <span className="truncate">{templateName}</span>
            {pdfPath && (
              <span className="truncate text-[11px] text-zinc-400 font-normal" title={pdfPath}>
                {pdfPath}
              </span>
            )}
          </div>

          <Badge variant="outline" className="text-[10px] bg-zinc-50 border-zinc-200 font-mono text-zinc-600">
            {totalFields} {totalFields === 1 ? 'field' : 'fields'}
          </Badge>

        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Compare toggle between blank template and filled PDF */}
          {isFilledAvailable && blankUrl && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => setDisplayMode(m => (m === 'filled' ? 'blank' : 'filled'))}
              className="text-zinc-700 hover:text-zinc-900 bg-white text-[11px] h-7 border-zinc-200"
              title="Toggle between blank template and filled PDF"
            >
              <Layers className="w-3 h-3 mr-1 text-zinc-500" />
              {displayMode === 'filled' ? 'Compare Blank' : 'Show Filled'}
            </Button>
          )}



          {frameUrl && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => window.open(displayMode === 'blank' && blankUrl ? blankUrl : frameUrl, '_blank')}
              className="text-zinc-700 hover:text-zinc-900 bg-white text-[11px] h-7"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Open External
            </Button>
          )}
        </div>
      </div>

      {/* Main PDF Viewport Frame */}
      <div className="flex-1 bg-zinc-200/60 p-3 overflow-hidden flex items-center justify-center relative">
        {frameUrl || blankUrl ? (
          <div
            className={cn(
              'relative w-full h-full bg-white rounded-md shadow-sm border border-zinc-300 overflow-hidden transition-all duration-700',
              isFadingInFilled && 'animate-fill-glow ring-2 ring-emerald-500/50'
            )}
            onAnimationEnd={e => {
              // The glow runs once; clear the flag when it ends so the
              // green ring doesn't stick around and the next fill replays it.
              if (e.target === e.currentTarget) setIsFadingInFilled(false)
            }}
          >
            {/* If a filled version is available, support crossfade between blank and filled */}
            {isFilledAvailable ? (
              <>
                {/* Layer 1: Blank Template PDF (Base Layer) */}
                {blankUrl && (
                  <iframe
                    id="blankPdfFrame"
                    title="Blank Template PDF"
                    src={withPdfViewerParams(blankUrl)}
                    className={cn(
                      'absolute inset-0 w-full h-full border-0 bg-white transition-opacity duration-1000',
                      displayMode === 'blank'
                        ? 'opacity-100 z-10 pointer-events-auto'
                        : 'opacity-0 pointer-events-none z-0'
                    )}
                  />
                )}

                {/* Layer 2: Generated Filled PDF (Crossfade Target) */}
                {filledUrl && (
                  <iframe
                    id="filledPdfFrame"
                    title="Filled Document PDF"
                    src={withPdfViewerParams(filledUrl)}
                    className={cn(
                      'absolute inset-0 w-full h-full border-0 bg-white transition-opacity duration-1000',
                      displayMode === 'filled' && filledFadeReady
                        ? 'opacity-100 z-20 pointer-events-auto'
                        : 'opacity-0 pointer-events-none z-0'
                    )}
                  />
                )}
              </>
            ) : (
              /* Standard Single Document Layer: ALWAYS 100% visible and interactive so user can inspect and read while talking/recording */
              <iframe
                id="documentPdfFrame"
                title="Template Document PDF Viewer"
                src={withPdfViewerParams(frameUrl || blankUrl)}
                className="w-full h-full border-0 bg-white opacity-100 pointer-events-auto"
              />
            )}

            {/* Laser Scanline Beam sweeping across PDF while the backend fills */}
            {isFilling && (
              <div className="absolute inset-x-0 h-1 pointer-events-none z-30 animate-scanline bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_20px_#3b82f6]" />
            )}

            {/* While Backend LLM is executing - floating capsule, doesn't blur or hide document */}
            {isFilling && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all">
                <div className="bg-zinc-950/90 text-white backdrop-blur-md px-4 py-2.5 rounded-xl shadow-2xl border border-zinc-800 flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-zinc-100">LLM Processing Document...</p>
                    <p className="text-[10px] text-zinc-400">Extracting narrative & mapping fields</p>
                  </div>
                </div>
              </div>
            )}


          </div>
        ) : (
          <div className="text-center p-8 max-w-sm space-y-3 bg-white border border-dashed border-zinc-300 rounded-lg shadow-xs">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-500">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">No PDF Loaded</p>
              <p className="text-xs text-zinc-500 mt-1">
                {loadError || 'Select a template or upload a new PDF form on the right.'}
              </p>
            </div>

            <label className="cursor-pointer inline-block pt-1">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleLocalFileChange}
              />
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload PDF Document</span>
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}
