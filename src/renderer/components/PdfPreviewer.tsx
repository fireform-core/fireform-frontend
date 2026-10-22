import React, { useState, useEffect, useRef } from 'react'
import {
  FileText,
  Upload,
  ExternalLink,
  Search,
  Eye,
  AlertCircle,
  CheckCircle2,
  Download,
} from 'lucide-react'
import { useStore } from '../store'
import { resolvePreviewUrl } from '../lib/api'
import { saveLastOutputPath } from '../lib/storage'
import { withPdfViewerParams } from '../lib/utils'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Card } from './ui/card'

export interface PdfPreviewerProps {
  initialPath?: string
}

export function PdfPreviewer({ initialPath }: PdfPreviewerProps = {}) {
  const storePreviewPath = useStore(s => s.previewPath)

  const [inputPath, setInputPath] = useState(initialPath || storePreviewPath || '')
  const [frameUrl, setFrameUrl] = useState('')
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' | '' }>({ message: '', type: '' })
  const activeObjectUrlRef = useRef<string | null>(null)
  const prevStorePathRef = useRef<string | null>(null)
  // Single hidden file input shared by every Upload button, so the visible
  // controls are real <button>s from the design system (keyboard-focusable,
  // focus-visible rings included) instead of label-wrapped divs.
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const target = initialPath || storePreviewPath
    if (target && target !== prevStorePathRef.current) {
      prevStorePathRef.current = target
      setInputPath(target)
      triggerPreview(target)
    }
  }, [storePreviewPath, initialPath])

  async function triggerPreview(path: string) {
    const raw = path.trim()
    if (!raw) {
      setStatus({ message: 'Enter a PDF path or URL first.', type: 'error' })
      return
    }
    setStatus({ message: 'Loading PDF preview...', type: 'info' })
    const url = await resolvePreviewUrl(raw)
    if (url) {
      setFrameUrl(url)
      setStatus({ message: `Loaded: ${raw}`, type: 'success' })
    } else {
      setFrameUrl('')
      setStatus({
        message: `Could not load "${raw}". The file was not found or the backend is unreachable.`,
        type: 'error',
      })
    }
  }

  function handleLocalFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset so choosing the same file twice in a row still fires onChange.
    e.target.value = ''
    if (!file) return
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current)
    }
    const url = URL.createObjectURL(file)
    activeObjectUrlRef.current = url
    setFrameUrl(url)
    setInputPath(file.name)
    setStatus({ message: `Viewing local file: ${file.name}`, type: 'success' })
  }

  function handlePreviewPath() {
    const path = inputPath.trim()
    if (path) saveLastOutputPath(path)
    triggerPreview(path)
  }

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  const fileName = inputPath ? inputPath.split('/').pop() : 'No PDF Loaded'

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-100 overflow-hidden font-sans">
      {/* Hidden input shared by all Upload buttons */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleLocalFile}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Inbuilt App Header Toolbar — matches the app header (h-12, white, zinc border) */}
      <div className="h-12 bg-white border-b border-zinc-200 px-4 flex items-center justify-between gap-3 flex-shrink-0 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0" aria-hidden="true">
            <FileText className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-900 truncate" title={inputPath || undefined}>
                {fileName}
              </span>
              {frameUrl && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  Inbuilt Viewer
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {frameUrl && (
            <>
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  const a = document.createElement('a')
                  a.href = frameUrl
                  a.download = fileName || 'document.pdf'
                  a.target = '_blank'
                  a.click()
                }}
                title="Download this PDF"
                className="text-xs"
              >
                <Download className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                Download
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => window.open(frameUrl, '_blank')}
                title="Open this PDF in a new window"
                className="text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                Open External
              </Button>
            </>
          )}

          <Button size="sm" onClick={openFilePicker} className="text-xs">
            <Upload className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            Upload PDF
          </Button>
        </div>
      </div>

      {/* Path Input & Search Bar */}
      <div className="bg-white border-b border-zinc-200 px-4 py-2 flex items-center gap-3 flex-shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" aria-hidden="true" />
          <Input
            value={inputPath}
            onChange={e => setInputPath(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handlePreviewPath()
              }
            }}
            placeholder="Enter server PDF path (e.g. src/inputs/sample.pdf or outputs/...) or full URL..."
            aria-label="PDF file path or URL"
            className="pl-8 text-xs font-mono h-8 bg-zinc-50 border-zinc-200 focus:bg-white"
          />
        </div>
        <Button
          onClick={handlePreviewPath}
          size="sm"
          className="text-xs h-8 px-3.5"
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
          Load Preview
        </Button>

        {status.message && (
          <Badge
            variant={status.type === 'error' ? 'destructive' : status.type === 'success' ? 'success' : 'outline'}
            role="status"
            aria-live="polite"
            className="gap-1.5 text-xs font-medium"
          >
            {status.type === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            )}
            <span className="truncate max-w-xs">{status.message}</span>
          </Badge>
        )}
      </div>

      {/* Inbuilt Viewport Area */}
      <div className="flex-1 bg-zinc-200/70 p-3 overflow-hidden flex items-center justify-center">
        {frameUrl ? (
          <div className="w-full h-full bg-white rounded-md shadow-sm border border-zinc-300 overflow-hidden">
            <iframe
              id="pdfFrame"
              title="PDF Inbuilt Document Preview"
              src={withPdfViewerParams(frameUrl)}
              className="w-full h-full border-0 bg-white"
            />
          </div>
        ) : (
          <Card className="max-w-md border-dashed p-8 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-500" aria-hidden="true">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">No PDF Document Loaded</p>
              <p className="text-xs text-zinc-500 mt-1">
                Enter a file path above, select a template from the library, or upload a local PDF to preview.
              </p>
            </div>
            <div className="pt-1">
              <Button size="sm" onClick={openFilePicker} className="text-xs">
                <Upload className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                Upload PDF Document
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
