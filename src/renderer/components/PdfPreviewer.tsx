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

  const fileName = inputPath ? inputPath.split('/').pop() : 'No PDF Loaded'

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-100 overflow-hidden font-sans">
      {/* Inbuilt App Header Toolbar */}
      <div className="h-12 bg-white border-b border-zinc-200 px-4 flex items-center justify-between flex-shrink-0 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-900 truncate">
                {fileName}
              </span>
              {frameUrl && (
                <Badge variant="outline" className="text-[10px] bg-zinc-50 border-zinc-200 text-zinc-600 font-mono">
                  Inbuilt Viewer
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
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
                className="text-zinc-700 hover:text-zinc-900 bg-white text-xs"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Download
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => window.open(frameUrl, '_blank')}
                className="text-zinc-700 hover:text-zinc-900 bg-white text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Open External
              </Button>
            </>
          )}

          <label className="cursor-pointer">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleLocalFile}
            />
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload PDF</span>
            </div>
          </label>
        </div>
      </div>

      {/* Path Input & Search Bar */}
      <div className="bg-white border-b border-zinc-200 px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
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
            className="pl-8 text-xs font-mono h-8 bg-zinc-50 border-zinc-200 focus:bg-white"
          />
        </div>
        <Button
          onClick={handlePreviewPath}
          size="sm"
          className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs h-8 px-3.5"
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          Load Preview
        </Button>

        {status.message && (
          <div
            className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 font-medium ${
              status.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : status.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
            }`}
          >
            {status.type === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            <span className="truncate max-w-xs">{status.message}</span>
          </div>
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
          <div className="text-center p-8 max-w-md bg-white border border-dashed border-zinc-300 rounded-lg shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-500">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">No PDF Document Loaded</p>
              <p className="text-xs text-zinc-500 mt-1">
                Enter a file path above, select a template from the library, or upload a local PDF to preview.
              </p>
            </div>
            <label className="cursor-pointer inline-block pt-1">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleLocalFile}
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

