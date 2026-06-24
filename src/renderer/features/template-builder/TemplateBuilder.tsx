import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store'
import { useFieldRows } from './hooks'
import { FieldsBuilder } from './fields-builder'
import {
  uploadTemplatePdf,
  createTemplate,
  makeFillable,
  fetchTemplates,
} from '../../lib/api'
import { DEFAULT_TEMPLATE_DIRECTORY } from '../../lib/constants'
import { formatBytes, pluralize, normalizeFieldType } from '../../lib/utils'
import { saveLastOutputPath } from '../../lib/storage'

export function TemplateBuilder() {
  const { upsertTemplate, setTemplates, addFillSelection, setPreviewPath } = useStore(s => ({
    upsertTemplate: s.upsertTemplate,
    setTemplates: s.setTemplates,
    addFillSelection: s.addFillSelection,
    setPreviewPath: s.setPreviewPath,
  }))

  const { fieldRows, addRow, removeRow, updateRow, moveRow, seedFromApiFields, resetRows } =
    useFieldRows()

  const [templateName, setTemplateName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedPath, setUploadedPath] = useState<string | null>(null)
  const [uploadedFieldCount, setUploadedFieldCount] = useState<number | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [makeFillableLoading, setMakeFillableLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [status, setStatus] = useState({ message: '', type: '' })
  const [jsonResponse, setJsonResponse] = useState<unknown>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const addFieldBtnRef = useRef<HTMLButtonElement>(null)
  const currentFileRef = useRef<File | null>(null)

  useEffect(() => {
    currentFileRef.current = selectedFile
  }, [selectedFile])

  function handleSelectFile(file: File | undefined | null) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setSelectedFile(null)
      setUploadedPath(null)
      setUploadedFieldCount(null)
      setStatus({ message: 'Please select a PDF file.', type: 'error' })
      return
    }
    setSelectedFile(file)
    setUploadedPath(null)
    setUploadedFieldCount(null)
    setJsonResponse(null)
    setStatus({ message: '', type: '' })
    uploadFileSilently(file)
  }

  async function uploadFileSilently(file: File) {
    try {
      const upload = await uploadTemplatePdf(file, DEFAULT_TEMPLATE_DIRECTORY)
      if (currentFileRef.current !== file) return
      setUploadedPath((upload['pdf_path'] as string) || null)
      const count = typeof upload['field_count'] === 'number' ? upload['field_count'] : null
      setUploadedFieldCount(count)
      const fields = upload['fields']
      if (Array.isArray(fields) && fields.length) {
        const result = seedFromApiFields(
          fields as Array<{ name: string; description?: string; type: string }>
        )
        if (result === 'seeded') {
          setStatus({
            message: `Loaded ${fields.length} field${fields.length === 1 ? '' : 's'} from the PDF — edit the descriptions as needed.`,
            type: 'info',
          })
        } else {
          setStatus({ message: 'Kept your existing form fields.', type: 'info' })
        }
      }
    } catch {
      // silent
    }
  }

  async function handleMakeFillable() {
    if (!selectedFile) {
      setStatus({ message: 'Select a PDF first.', type: 'error' })
      return
    }
    setMakeFillableLoading(true)
    setStatus({
      message: 'Uploading PDF and running fillable-field detection (this can take a minute)...',
      type: 'info',
    })
    try {
      let pdfPath = uploadedPath
      if (!pdfPath) {
        const upload = await uploadTemplatePdf(selectedFile, DEFAULT_TEMPLATE_DIRECTORY)
        pdfPath = (upload['pdf_path'] as string) || null
        setUploadedPath(pdfPath)
      }
      const body = await makeFillable(pdfPath!)
      const newPath = (body['pdf_path'] as string) || pdfPath!
      const count = typeof body['field_count'] === 'number' ? body['field_count'] : null
      setUploadedPath(newPath)
      setUploadedFieldCount(count)
      setStatus({
        message:
          count !== null
            ? `Fillable PDF created — ${count} field${count === 1 ? '' : 's'} detected.`
            : 'Fillable PDF created.',
        type: 'success',
      })
    } catch (e: unknown) {
      setStatus({ message: (e as Error).message, type: 'error' })
    }
    setMakeFillableLoading(false)
  }

  function collectFields(): { value?: Record<string, string>; error?: string } {
    if (fieldRows.length === 0) {
      return { error: 'Add at least one field before creating the template.' }
    }
    const dict: Record<string, string> = {}
    const seen = new Set<string>()
    for (const row of fieldRows) {
      const name = row.name.trim()
      if (!name) return { error: 'Every field needs a name.' }
      const key = name.toLowerCase()
      if (seen.has(key)) return { error: `Field names must be unique ("${name}" appears more than once).` }
      seen.add(key)
      dict[name] = normalizeFieldType(row.type)
    }
    return { value: dict }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setJsonResponse(null)
    setStatus({ message: '', type: '' })

    if (!templateName.trim() || !selectedFile) {
      setStatus({ message: 'Name and PDF file are required.', type: 'error' })
      return
    }
    const collected = collectFields()
    if (collected.error) {
      setStatus({ message: collected.error, type: 'error' })
      return
    }

    try {
      let pdfPath = uploadedPath
      if (!pdfPath) {
        setStatus({ message: 'Copying PDF into project directory...', type: 'info' })
        const upload = await uploadTemplatePdf(selectedFile, DEFAULT_TEMPLATE_DIRECTORY)
        pdfPath = (upload['pdf_path'] as string) || null
        setUploadedPath(pdfPath)
      }

      setStatus({ message: 'Creating template...', type: 'info' })
      const body = await createTemplate({
        name: templateName.trim(),
        pdf_path: pdfPath!,
        fields: collected.value!,
      })

      upsertTemplate({
        id: body['id'] as number,
        name: (body['name'] as string) || '',
        pdf_path: (body['pdf_path'] as string) || '',
        fields: (body['fields'] as Record<string, string>) || {},
      })
      if (body['id'] != null) addFillSelection(Number(body['id']))
      if (body['pdf_path']) {
        setPreviewPath(body['pdf_path'] as string)
        saveLastOutputPath(body['pdf_path'] as string)
      }

      const freshTemplates = await fetchTemplates()
      setTemplates(freshTemplates)

      const expected = body['field_count']
      const actual = Object.keys(collected.value!).length
      let note = ''
      let level = 'success'
      if (typeof expected === 'number' && expected !== actual) {
        note = ` Heads up — the PDF has ${expected} fillable field${expected === 1 ? '' : 's'}, but you added ${actual} row${actual === 1 ? '' : 's'}. Fills may be incomplete or misaligned.`
        level = 'error'
      }
      setStatus({
        message: `Template created (id: ${body['id']}). PDF saved at ${pdfPath}.${note}`,
        type: level,
      })
      setJsonResponse(body)
      setUploadedPath(null)
      setUploadedFieldCount(null)
    } catch (e: unknown) {
      setStatus({ message: (e as Error).message, type: 'error' })
    }
  }

  const destinationPath = selectedFile
    ? `${DEFAULT_TEMPLATE_DIRECTORY}/${selectedFile.name}`
    : ''

  const fieldCountMatch =
    selectedFile && uploadedFieldCount !== null
      ? uploadedFieldCount === fieldRows.length
        ? 'match'
        : 'mismatch'
      : null

  const fieldCountText =
    fieldCountMatch === 'match'
      ? `PDF has ${pluralize(uploadedFieldCount!, 'fillable field')} — your ${pluralize(fieldRows.length, 'row')} match.`
      : fieldCountMatch === 'mismatch'
        ? `PDF has ${pluralize(uploadedFieldCount!, 'fillable field')} — you have ${pluralize(fieldRows.length, 'row')}.`
        : ''

  return (
    <section className="panel card">
      <h2>Create Template</h2>
      <form className="stacked-form" onSubmit={handleSubmit}>
        <label htmlFor="templateName">Template Name</label>
        <input
          id="templateName"
          type="text"
          placeholder="Incident Intake Form"
          required
          value={templateName}
          onChange={e => setTemplateName(e.target.value)}
        />

        <label>Template PDF File</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={e => handleSelectFile(e.target.files?.[0])}
        />

        {!selectedFile ? (
          <div
            className={`dropzone${isDragActive ? ' active' : ''}`}
            role="button"
            tabIndex={0}
            aria-label="Drag and drop a PDF file or click to select"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true) }}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true) }}
            onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false) }}
            onDragEnd={e => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false) }}
            onDrop={e => {
              e.preventDefault()
              e.stopPropagation()
              setIsDragActive(false)
              handleSelectFile(e.dataTransfer?.files?.[0])
            }}
          >
            <strong>Drag and drop a PDF here</strong>
            <span>or click to select a file</span>
          </div>
        ) : (
          <button
            type="button"
            className="secondary-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Change PDF
          </button>
        )}

        <p className="helper">
          {selectedFile
            ? `Selected: ${selectedFile.name} (${formatBytes(selectedFile.size)}) — destination: ${destinationPath}`
            : 'No PDF selected.'}
        </p>

        <div className="inline-actions">
          <button
            type="button"
            className="secondary-btn"
            disabled={!selectedFile || makeFillableLoading}
            onClick={handleMakeFillable}
          >
            {makeFillableLoading ? 'Working...' : uploadedFieldCount !== null ? 'Re-detect fields' : 'Make this PDF fillable'}
          </button>
          <button
            type="button"
            className="help-trigger"
            aria-expanded={showHelp}
            aria-controls="makeFillableHelp"
            aria-label="What does this do?"
            onClick={() => setShowHelp(v => !v)}
          >
            ?
          </button>
        </div>
        {showHelp && (
          <p id="makeFillableHelp" className="helper">
            Use this only if your PDF doesn't already have fillable form fields. It runs an AI
            step to detect fields and add them (slower). Skip it if your PDF is already fillable.
          </p>
        )}

        <label>Form Fields</label>
        <p className="helper">
          What information should be filled in? Add one row per field. Fields are filled into
          your PDF in the order shown — drag to reorder.
        </p>

        {fieldCountMatch && (
          <p
            className={`field-count-badge ${fieldCountMatch}`}
            aria-live="polite"
          >
            {fieldCountText}
          </p>
        )}

        <FieldsBuilder
          rows={fieldRows}
          onUpdate={updateRow}
          onRemove={removeRow}
          onMove={moveRow}
        />

        <button
          ref={addFieldBtnRef}
          type="button"
          className="secondary-btn"
          onClick={() => {
            addRow()
            setTimeout(() => {
              const inputs = document.querySelectorAll('.field-row .field-name')
              if (inputs.length) (inputs[inputs.length - 1] as HTMLInputElement).focus()
            }, 0)
          }}
        >
          + Add Field
        </button>

        <button type="submit">Create Template</button>
      </form>

      <p className={`status${status.type ? ` ${status.type}` : ''}`} aria-live="polite">
        {status.message}
      </p>
      {jsonResponse != null && (
        <pre className="json-output">{JSON.stringify(jsonResponse, null, 2)}</pre>
      )}

      <p className="pii-notice">
        Templates and any form data submitted against them are stored locally on
        this device. Any personally identifiable information stays on the machine
        running FireForm.
      </p>
    </section>
  )
}
