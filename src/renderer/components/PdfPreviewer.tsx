import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { resolvePreviewUrl } from '../lib/api'
import { saveLastOutputPath } from '../lib/storage'

export function PdfPreviewer() {
  const storePreviewPath = useStore(s => s.previewPath)

  const [inputPath, setInputPath] = useState(storePreviewPath || '')
  const [frameUrl, setFrameUrl] = useState('')
  const [status, setStatus] = useState({ message: '', type: '' })
  const activeObjectUrlRef = useRef<string | null>(null)
  // Start as null so a path that's already set when this component mounts
  // (e.g. after navigating here from Templates) triggers a preview too.
  const prevStorePathRef = useRef<string | null>(null)

  useEffect(() => {
    if (storePreviewPath && storePreviewPath !== prevStorePathRef.current) {
      prevStorePathRef.current = storePreviewPath
      setInputPath(storePreviewPath)
      triggerPreview(storePreviewPath)
    }
  }, [storePreviewPath])

  async function triggerPreview(path: string) {
    const raw = path.trim()
    if (!raw) {
      setStatus({ message: 'Enter a PDF path or URL first.', type: 'error' })
      return
    }
    setStatus({ message: 'Attempting to preview path...', type: 'info' })
    const url = await resolvePreviewUrl(raw)
    if (url) {
      setFrameUrl(url)
      setStatus({ message: `Previewing: ${url}`, type: 'success' })
    } else {
      const likelyLocal = !/^https?:\/\//i.test(raw) && !raw.startsWith('/')
      setStatus({
        message: likelyLocal
          ? `Could not preview "${raw}". It looks like a server-local path and may not be web-accessible.`
          : `Could not preview path.`,
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
    setStatus({ message: `Previewing local file: ${file.name}`, type: 'success' })
  }

  function handlePreviewPath() {
    const path = inputPath.trim()
    if (path) saveLastOutputPath(path)
    triggerPreview(path)
  }

  return (
    <section className="panel card">
      <h2>PDF Preview</h2>

      <div className="preview-controls">
        <label htmlFor="localPdfFile">Preview Local PDF</label>
        <input
          id="localPdfFile"
          type="file"
          accept="application/pdf"
          onChange={handleLocalFile}
        />
      </div>

      <div className="preview-controls">
        <label htmlFor="serverPdfPath">Preview from Template or Output Path</label>
        <div className="inline-actions">
          <input
            id="serverPdfPath"
            type="text"
            placeholder="src/inputs/file_template.pdf or https://..."
            spellCheck={false}
            value={inputPath}
            onChange={e => setInputPath(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handlePreviewPath() } }}
          />
          <button type="button" onClick={handlePreviewPath}>
            Preview Path
          </button>
        </div>
      </div>

      <p className={`status${status.type ? ` ${status.type}` : ''}`} aria-live="polite">
        {status.message}
      </p>

      {frameUrl && (
        <iframe
          id="pdfFrame"
          title="PDF Preview"
          src={frameUrl}
        />
      )}
    </section>
  )
}
