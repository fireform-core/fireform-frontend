import { useState, useEffect, useMemo } from 'react'
import { useStore } from '../../store'
import type { FieldRow, Template } from '../../types'
import { DocumentViewer } from './DocumentViewer'
import { StudioSidebar } from './StudioSidebar'
import { useFieldRows } from '../template-builder/hooks'
import { useSpeechRecording } from '../fill-form/hooks'
import {
  uploadTemplatePdf,
  createTemplate,
  updateTemplate,
  makeFillable,
  fetchTemplates,

  fillTemplate,
} from '../../lib/api'
import { saveLastOutputPath } from '../../lib/storage'
import { WeatherModal } from '../weather-forecast/WeatherForecast'
import { ZipcodeModal } from '../zipcode-resolver/ZipcodeResolver'
import { DEFAULT_TEMPLATE_DIRECTORY, MAX_TEMPLATE_PDF_BYTES } from '../../lib/constants'
import { formatBytes } from '../../lib/utils'

export function Studio() {
  const {
    templates,
    setTemplates,
    upsertTemplate,
    activeTemplateId,
    setActiveTemplateId,
    selectedFieldKey,
    setSelectedFieldKey,
    setPreviewPath,
    narrativeText,
    setNarrativeText,
  } = useStore(s => ({
    templates: s.templates,
    setTemplates: s.setTemplates,
    upsertTemplate: s.upsertTemplate,
    activeTemplateId: s.activeTemplateId,
    setActiveTemplateId: s.setActiveTemplateId,
    selectedFieldKey: s.selectedFieldKey,
    setSelectedFieldKey: s.setSelectedFieldKey,
    setPreviewPath: s.setPreviewPath,
    narrativeText: s.narrativeText,
    setNarrativeText: s.setNarrativeText,
  }))

  // The unsaved Builder draft lives in the store (memory only) so it survives tab switches
  const draft = useStore(s => s.studioDraft)
  const setDraft = useStore(s => s.setStudioDraft)
  const setStudioFieldRows = useStore(s => s.setStudioFieldRows)
  const { mode, templateName, templateDescription, selectedFile, uploadedPdfPath } = draft
  const setMode = (next: typeof mode) => setDraft({ mode: next })
  const setTemplateName = (name: string) => setDraft({ templateName: name })
  const setTemplateDescription = (description: string) =>
    setDraft({ templateDescription: description, descriptionEdited: true })
  const setSelectedFile = (file: File | null) => setDraft({ selectedFile: file })
  const setUploadedPdfPath = (path: string | null) => setDraft({ uploadedPdfPath: path })

  // Filler state
  const selectedLLM = useStore(s => s.selectedLLM)
  const [weatherCoords, setWeatherCoords] = useState<{ lat: number; lon: number } | null>(null)

  // Modals & Loaders
  const [isMakeFillableLoading, setIsMakeFillableLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isFilling, setIsFilling] = useState(false)
  const [isWeatherOpen, setIsWeatherOpen] = useState(false)
  const [isZipcodeOpen, setIsZipcodeOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null)

  const { fieldRows, seedFromApiFields, resetRows, ...rowEdits } = useFieldRows([draft.fieldRows, setStudioFieldRows])
  // Studio's flat {label: type} dict is lossy (it drops the extracted schema/tables and merges
  // duplicate labels), so fields are only sent once the user has edited the rows; otherwise
  // the backend extracts (create) or keeps (update) the PDF's own schema.
  const addRow = () => {
    setDraft({ fieldsEdited: true })
    rowEdits.addRow()
  }
  const removeRow = (index: number) => {
    setDraft({ fieldsEdited: true })
    rowEdits.removeRow(index)
  }
  const updateRow = (index: number, updates: Partial<FieldRow>) => {
    setDraft({ fieldsEdited: true })
    // Selection is by name, so follow the selected row when Field Properties renames it
    if (updates.name !== undefined && fieldRows[index]?.name === selectedFieldKey) {
      setSelectedFieldKey(updates.name)
    }
    rowEdits.updateRow(index, updates)
  }

  // Hook for voice transcription
  const { sttState, sttStatus, start: startRecording, stop: stopRecording } = useSpeechRecording(transcript => {
    if (transcript) {
      setNarrativeText((prev: string) => (prev ? `${prev}\n${transcript}` : transcript))
      setStatusMessage({ text: 'Voice transcript added to narrative.', type: 'success' })
    }
  })

  // Surface recorder progress and failures (permission denied, no speech, ...) in the status banner
  useEffect(() => {
    if (!sttStatus || sttStatus === 'Transcription added.') return
    const isError = /denied|failed|not available|no speech|nothing recorded/i.test(sttStatus)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatusMessage({ text: `Voice: ${sttStatus}`, type: isError ? 'error' : 'info' })
  }, [sttStatus])



  // Active template from the store; null means "new template" (clean slate)
  const activeTemplate = useMemo(() => {
    if (activeTemplateId) {
      return templates.find(t => t.id === activeTemplateId) || null
    }
    return null
  }, [activeTemplateId, templates])

  // Re-seed only when a different template becomes active; remounting Studio (tab switch)
  // or re-opening the same template keeps the draft
  useEffect(() => {
    const { seededTemplateId } = useStore.getState().studioDraft
    if (activeTemplate && activeTemplate.id !== seededTemplateId) {
      setTemplateName(activeTemplate.name)

      setUploadedPdfPath(activeTemplate.pdf_path)

      // Seed fields from active template
      const fieldsObj = activeTemplate.fields || {}
      if (typeof fieldsObj === 'object') {
        const schema = (fieldsObj as any).schema?.properties || fieldsObj
        const entries = Object.entries(schema).map(([k, v]: [string, any]) => ({
          name: typeof v === 'object' && v.description ? v.description : k,
          type: typeof v === 'object' && v.type ? v.type : typeof v === 'string' ? v : 'string',
        }))
        if (entries.length > 0) {
          seedFromApiFields(entries, false)
        } else {
          resetRows()
        }
      }
      setSelectedFile(null)
      setDraft({ fieldsEdited: false, pdfChanged: false, descriptionEdited: false, seededTemplateId: activeTemplate.id })
    } else if (!activeTemplate && seededTemplateId !== null) {
      // Switched to "New Template": clear the previous template's data
      setTemplateName('')
      setUploadedPdfPath(null)
      resetRows()
      setSelectedFile(null)
      setDraft({ fieldsEdited: false, pdfChanged: false, descriptionEdited: false, seededTemplateId: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTemplate])

  // Handle PDF file selection & upload
  const handleFileSelect = async (file: File) => {
    if (file.size > MAX_TEMPLATE_PDF_BYTES) {
      setStatusMessage({
        text: `${file.name} is ${formatBytes(file.size)}. The maximum template size is ${formatBytes(MAX_TEMPLATE_PDF_BYTES)}.`,
        type: 'error',
      })
      return
    }
    setSelectedFile(file)
    if (!templateName) {
      setTemplateName(file.name.replace(/\.[^/.]+$/, ''))
    }
    try {
      setStatusMessage({ text: 'Uploading template PDF...', type: 'info' })
      const res: any = await uploadTemplatePdf(file, DEFAULT_TEMPLATE_DIRECTORY)
      const path = typeof res?.pdf_path === 'string' ? res.pdf_path : ''
      setUploadedPdfPath(path)
      setDraft({ pdfChanged: true })
      // Seed the field list from the fillable fields the backend extracted
      const fields = Array.isArray(res?.fields) ? res.fields : []
      const seeded = fields.length > 0 ? seedFromApiFields(fields) : null
      if (seeded === 'seeded') setDraft({ fieldsEdited: false })
      const detail =
        seeded === 'seeded'
          ? ` — loaded ${fields.length} field${fields.length === 1 ? '' : 's'} from the PDF`
          : seeded === 'kept'
            ? ' — kept your existing fields'
            : res?.field_count === 0
              ? ' — no fillable fields found; try AI Schema'
              : ''
      setStatusMessage({ text: `Uploaded ${file.name}${detail}`, type: 'success' })
    } catch (err: any) {
      setStatusMessage({ text: `Upload failed: ${err.message}`, type: 'error' })
    }
  }

  // Handle Make Fillable / AI Schema Extraction
  const handleMakeFillable = async () => {
    if (!uploadedPdfPath && !selectedFile) {
      setStatusMessage({ text: 'Please select or upload a PDF first.', type: 'error' })
      return
    }

    setIsMakeFillableLoading(true)
    setStatusMessage({ text: 'Detecting form fields and creating a fillable PDF (this can take a minute)...', type: 'info' })
    try {
      let path = uploadedPdfPath
      if (!path && selectedFile) {
        const res: any = await uploadTemplatePdf(selectedFile, DEFAULT_TEMPLATE_DIRECTORY)
        path = typeof res?.pdf_path === 'string' ? res.pdf_path : null
        setUploadedPdfPath(path)
      }

      if (!path) throw new Error('No PDF path available.')

      // Backend returns { pdf_path, field_count } for the fillable copy; failures are errors
      // (MAKE_FILLABLE_FAILED) and land in the catch below.
      const res: any = await makeFillable(path)
      const count = typeof res?.field_count === 'number' ? res.field_count : null
      setUploadedPdfPath(typeof res?.pdf_path === 'string' && res.pdf_path ? res.pdf_path : path)
      // If the user manually edited fields, confirm before discarding them
      if (draft.fieldsEdited) {
        const ok = window.confirm(
          'You have manually edited fields. AI Schema will replace them with fields extracted from the PDF. Continue?'
        )
        if (!ok) {
          setStatusMessage({ text: 'AI Schema cancelled — your manual fields were kept.', type: 'info' })
          return
        }
      }
      // Drop rows; Register will extract the schema directly from the fillable PDF
      seedFromApiFields([], false)
      setDraft({ fieldsEdited: false, pdfChanged: true })
      const countText = count !== null ? ` with ${count} field${count === 1 ? '' : 's'} detected` : ''
      setStatusMessage({ text: `Fillable PDF created${countText}. Its fields are read from the PDF when you register.`, type: 'success' })
    } catch (err: any) {
      setStatusMessage({ text: `Extraction failed: ${err.message}`, type: 'error' })
    } finally {
      setIsMakeFillableLoading(false)
    }
  }

  // Handle Register Template
  const handleRegisterTemplate = async () => {
    if (!templateName.trim()) {
      setStatusMessage({ text: 'Please provide a template name.', type: 'error' })
      return
    }
    if (!uploadedPdfPath) {
      setStatusMessage({ text: 'Upload a PDF template before registering.', type: 'error' })
      return
    }

    setIsRegistering(true)
    setStatusMessage({ text: 'Registering template in database...', type: 'info' })
    try {
      // Empty fields ({}) let the backend extract the PDF's schema; see draft.fieldsEdited
      const fieldsDict: Record<string, string> = {}
      if (draft.fieldsEdited) fieldRows.forEach(f => {
        if (f.name.trim()) fieldsDict[f.name.trim()] = f.type || 'string'
      })

      const created: any = await createTemplate({
        name: templateName.trim(),
        description: templateDescription.trim(),
        pdf_path: uploadedPdfPath || 'src/inputs/sample.pdf',
        fields: fieldsDict,
      })

      const newTemplate: Template = {
        id: Number(created.id),
        name: created.name || templateName.trim(),
        description: created.description || templateDescription.trim(),
        pdf_path: created.pdf_path || uploadedPdfPath || '',
        fields: created.fields || fieldsDict,
        field_count: created.field_count,
      }

      upsertTemplate(newTemplate)
      setActiveTemplateId(newTemplate.id)
      setStatusMessage({ text: `Template "${newTemplate.name}" registered!`, type: 'success' })

      // Refresh templates
      fetchTemplates().then(setTemplates)
    } catch (err: any) {
      setStatusMessage({ text: `Registration failed: ${err.message}`, type: 'error' })
    } finally {
      setIsRegistering(false)
    }
  }

  // Save edits to the active (existing) template instead of registering a duplicate
  const handleSaveTemplate = async () => {
    if (!activeTemplate) return
    if (!templateName.trim()) {
      setStatusMessage({ text: 'Please provide a template name.', type: 'error' })
      return
    }
    if (draft.pdfChanged) {
      setStatusMessage({
        text: 'The PDF changed. Save Changes can only update the name and fields; register it as a new template (Templates → New Template) instead.',
        type: 'error',
      })
      return
    }

    setIsRegistering(true)
    setStatusMessage({ text: 'Saving template changes...', type: 'info' })
    try {
      const fieldsDict: Record<string, string> = {}
      fieldRows.forEach(f => {
        if (f.name.trim()) fieldsDict[f.name.trim()] = f.type || 'string'
      })

      // If the user edited fields but all entries are blank/removed, reject rather than silently dropping the edit
      if (draft.fieldsEdited && Object.keys(fieldsDict).length === 0) {
        setStatusMessage({
          text: 'All field names are empty. Add at least one field name or undo your changes before saving.',
          type: 'error',
        })
        return
      }
      // Send fields only when the user edited them (and left some valid ones), so the stored schema is kept
      const sendFields = draft.fieldsEdited && Object.keys(fieldsDict).length > 0
      const updated = await updateTemplate(activeTemplate.id, {
        name: templateName.trim(),
        ...(sendFields ? { fields: fieldsDict } : {}),
      })

      upsertTemplate({
        ...activeTemplate,
        name: (updated['name'] as string) || templateName.trim(),
        pdf_path: (updated['pdf_path'] as string) || activeTemplate.pdf_path,
        fields: (updated['fields'] as Template['fields']) || activeTemplate.fields,
        field_count: typeof updated['field_count'] === 'number' ? updated['field_count'] : undefined,
      })
      setDraft({ fieldsEdited: false, descriptionEdited: false })
      setStatusMessage({ text: `Template "${templateName.trim()}" saved.`, type: 'success' })
    } catch (err) {
      setStatusMessage({ text: `Save failed: ${(err as Error).message}`, type: 'error' })
    } finally {
      setIsRegistering(false)
    }
  }

  // Handle Auto-Fill Form
  const handleFillForm = async () => {
    if (!narrativeText.trim()) {
      setStatusMessage({ text: 'Please enter incident narrative or notes.', type: 'error' })
      return
    }

    const tplId = activeTemplate?.id ?? null
    if (!tplId) {
      setStatusMessage({ text: 'Please select or register a template first.', type: 'error' })
      return
    }
    if (!selectedLLM) {
      setStatusMessage({ text: 'Select an available provider and model in Settings first.', type: 'error' })
      return
    }

    setIsFilling(true)
    setStatusMessage({ text: 'Running LLM pipeline to fill document...', type: 'info' })
    try {
      const res: any = await fillTemplate({
        template_id: tplId,
        input_text: narrativeText.trim(),
        provider: selectedLLM.provider,
        model: selectedLLM.model,
      })

      const outPath = typeof res?.output_pdf_path === 'string' ? res.output_pdf_path : ''
      if (outPath) {
        setPreviewPath(outPath)
        setUploadedPdfPath(outPath)
        saveLastOutputPath(outPath)
        useStore.getState().markNarrativeFilled()
        setStatusMessage({ text: 'Document filled and PDF created!', type: 'success' })
      }
    } catch (err: any) {
      setStatusMessage({ text: `Fill failed: ${err.message}`, type: 'error' })
    } finally {
      setIsFilling(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-100">
      {/* Status banner if active */}
      {statusMessage && (
        <div
          className={`px-4 py-1.5 text-xs font-medium flex items-center justify-between transition-all ${
            statusMessage.type === 'error'
              ? 'bg-red-600 text-white'
              : statusMessage.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-900 text-white'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs hover:opacity-80 px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Main 2/3 and 1/3 Split Workspace (Layout from Photo 1) */}
      <div className="flex-1 flex h-full overflow-hidden">
        {/* Left Pane (2/3 width): Real PDF Document Viewer */}
        <DocumentViewer
          template={activeTemplate}
          fields={fieldRows}
          pdfPath={uploadedPdfPath || activeTemplate?.pdf_path}
          onFileSelect={handleFileSelect}
        />

        {/* Right Pane (1/3 width): Studio Sidebar */}
        <StudioSidebar
          mode={mode}
          onModeChange={setMode}
          templateName={templateName}
          onTemplateNameChange={setTemplateName}
          templateDescription={templateDescription}
          onTemplateDescriptionChange={setTemplateDescription}
          selectedFile={selectedFile}
          hasPdf={Boolean(uploadedPdfPath || activeTemplate?.pdf_path)}
          onFileSelect={handleFileSelect}
          fieldRows={fieldRows}
          onAddField={addRow}
          onRemoveField={removeRow}
          onUpdateField={updateRow}
          selectedFieldKey={selectedFieldKey}
          onSelectField={setSelectedFieldKey}
          onMakeFillable={handleMakeFillable}
          isMakeFillableLoading={isMakeFillableLoading}
          onRegisterTemplate={activeTemplate ? handleSaveTemplate : handleRegisterTemplate}
          isExistingTemplate={Boolean(activeTemplate)}
          isRegistering={isRegistering}
          narrativeText={narrativeText}
          onNarrativeChange={setNarrativeText}
          isRecording={sttState === 'recording'}
          isTranscribing={sttState === 'transcribing'}
          onToggleRecording={() => {
            if (sttState === 'recording') stopRecording()
            else startRecording()
          }}
          onFillForm={handleFillForm}
          isFilling={isFilling}
          onOpenWeather={() => setIsWeatherOpen(true)}
          onOpenZipcode={() => setIsZipcodeOpen(true)}
        />
      </div>

      {/* Assistant Modals */}
      <WeatherModal
        isOpen={isWeatherOpen}
        onClose={() => setIsWeatherOpen(false)}
        initialLatitude={weatherCoords?.lat}
        initialLongitude={weatherCoords?.lon}
        onAgree={weatherText => {
          setNarrativeText((prev: string) => (prev ? `${prev}\n\n[WEATHER CONDITIONS]\n${weatherText}` : weatherText))
          setIsWeatherOpen(false)
        }}
      />

      <ZipcodeModal
        isOpen={isZipcodeOpen}
        onClose={() => setIsZipcodeOpen(false)}
        onFetchWeather={(lat, lon) => {
          setWeatherCoords({ lat, lon })
          setIsZipcodeOpen(false)
          setIsWeatherOpen(true)
          setStatusMessage({ text: `Address located at ${lat.toFixed(4)}, ${lon.toFixed(4)}`, type: 'info' })
        }}
      />
    </div>
  )
}
