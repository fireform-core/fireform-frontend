import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { useSpeechRecording } from './hooks'
import { fillTemplate, fetchModels } from '../../lib/api'
import { saveLastOutputPath } from '../../lib/storage'
import { pluralize } from '../../lib/utils'

import { WeatherModal } from '../weather-forecast/WeatherForecast'
import { ZipcodeModal } from '../zipcode-resolver/ZipcodeResolver'
import { useDeleteTemplate } from '../../lib/useDeleteTemplate'
import { ConfirmDialog, TrashIcon } from '../../components/ConfirmDialog'

export function FillForm() {
  const { templates, selectedFillIds, toggleFillSelection, setActiveTab, setPreviewPath } =
    useStore(s => ({
      templates: s.templates,
      selectedFillIds: s.selectedFillIds,
      toggleFillSelection: s.toggleFillSelection,
      setActiveTab: s.setActiveTab,
      setPreviewPath: s.setPreviewPath,
    }))

  const del = useDeleteTemplate()
  const [inputText, setInputText] = useState('')
  const [model, setModel] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [defaultModel, setDefaultModel] = useState('')
  const [status, setStatus] = useState({ message: '', type: '' })
  const [jsonResponse, setJsonResponse] = useState<unknown>(null)
  const [selectionError, setSelectionError] = useState(false)
  const [isWeatherOpen, setIsWeatherOpen] = useState(false)
  const [weatherData, setWeatherData] = useState<string | null>(null)
  const [isLocationOpen, setIsLocationOpen] = useState(false)
  const [initialWeatherLat, setInitialWeatherLat] = useState<number | undefined>(undefined)
  const [initialWeatherLon, setInitialWeatherLon] = useState<number | undefined>(undefined)

  function handleFetchWeatherFromLocation(lat: number, lon: number) {
    setInitialWeatherLat(lat)
    setInitialWeatherLon(lon)
    setIsLocationOpen(false)
    setIsWeatherOpen(true)
  }

  const { sttState, sttStatus, start, togglePause, stop } = useSpeechRecording(text => {
    if (!text) return
    setInputText(prev => (prev.trim() ? `${prev.trim()} ${text}` : text))
  })

  useEffect(() => {
    fetchModels()
      .then(data => {
        setModels(data.models || [])
        setDefaultModel(data.default || '')
        setModel(data.default || '')
      })
      .catch(() => {
        // leave default empty — server will use its default
      })
  }, [])

  const count = selectedFillIds.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setJsonResponse(null)
    setStatus({ message: '', type: '' })

    if (!count) {
      setSelectionError(true)
      setStatus({ message: 'Select at least one form to fill.', type: 'error' })
      return
    }
    setSelectionError(false)

    if (!inputText.trim()) {
      setStatus({ message: 'Input text is required.', type: 'error' })
      return
    }

    const selectedModel = model || undefined
    setStatus({ message: `Filling ${pluralize(count, 'form')}…`, type: 'info' })

    const results: Record<string, unknown>[] = []
    const errors: string[] = []

    let finalInputText = inputText.trim()
    if (weatherData) finalInputText += `\n\n${weatherData}`

    for (const id of selectedFillIds) {
      try {
        const result = await fillTemplate({ template_id: id, input_text: finalInputText, model: selectedModel })
        results.push(result)
      } catch (e: unknown) {
        const template = templates.find(t => t.id === id)
        const label = template?.name || `id ${id}`
        errors.push(`${label}: ${(e as Error).message}`)
      }
    }

    const lastResult = results[results.length - 1]
    if (lastResult) {
      setJsonResponse(results.length === 1 ? lastResult : results)
      if (lastResult['output_pdf_path']) {
        const path = lastResult['output_pdf_path'] as string
        saveLastOutputPath(path)
        setPreviewPath(path)
      }
    }

    const parts: string[] = []
    if (results.length) parts.push(`${results.length} filled`)
    if (errors.length) parts.push(`${errors.length} failed`)
    const level = errors.length ? (results.length ? 'info' : 'error') : 'success'
    const detail = errors.length ? ` ${errors.join('; ')}` : ''
    setStatus({ message: `${parts.join(', ')}.${detail}`, type: level })

    if (lastResult?.['output_pdf_path']) {
      setActiveTab('pdfPreviewer')
    }
  }

  function handleTilePreview(pdfPath: string) {
    setPreviewPath(pdfPath)
    setActiveTab('pdfPreviewer')
  }

  const isRecording = sttState === 'recording'
  const isPaused = sttState === 'paused'
  const isTranscribing = sttState === 'transcribing'
  const sttDotClass = isRecording
    ? 'h-[9px] w-[9px] shrink-0 rounded-full bg-[#a43434] animate-pulse'
    : isPaused
      ? 'h-[9px] w-[9px] shrink-0 rounded-full bg-[#125a86]'
      : 'h-[9px] w-[9px] shrink-0 rounded-full bg-[#c2ccd6]'

  return (
    <section className="grid gap-3.5 rounded-[14px] border border-[#d7dde3] bg-white p-[18px] shadow-[0_10px_28px_rgba(16,44,70,0.09)]">
      <h2 className="mb-3.5 text-xl font-semibold">Fill Form</h2>
      <form className="grid gap-2.5" onSubmit={handleSubmit}>
        <label htmlFor="inputText" className="font-semibold">Incident Input Text</label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-[7px] justify-self-start rounded-[10px] border border-[#d7dde3] bg-[#f1f5f9] px-3.5 py-2 font-semibold text-[#0b4568] hover:bg-[#e5ecf3] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isRecording || isPaused || isTranscribing}
            onClick={start}
          >
            <span className={sttDotClass} aria-hidden="true" />
            Record
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-[7px] justify-self-start rounded-[10px] border border-[#d7dde3] bg-[#f1f5f9] px-3.5 py-2 font-semibold text-[#0b4568] hover:bg-[#e5ecf3] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isRecording && !isPaused}
            onClick={togglePause}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-[7px] justify-self-start rounded-[10px] border border-[#d7dde3] bg-[#f1f5f9] px-3.5 py-2 font-semibold text-[#0b4568] hover:bg-[#e5ecf3] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isRecording && !isPaused}
            onClick={stop}
          >
            Stop &amp; Transcribe
          </button>
          <span className="min-h-[1.2em] text-[0.92rem] text-[#576779]" aria-live="polite">
            {sttStatus}
          </span>
        </div>

        <textarea
          className="w-full rounded-[10px] border border-[#bcc8d6] bg-white px-3 py-2.5 text-[#1f2a36] focus:border-[#125a86] focus:outline-none focus:ring-2 focus:ring-[#125a86]"
          id="inputText"
          rows={6}
          placeholder="Describe the incident using natural language, or use the recorder above..."
          value={inputText}
          onChange={e => setInputText(e.target.value)}
        />

        <label className="font-semibold">Forms to fill</label>
        <p className={selectionError ? 'm-0 text-[0.95rem] font-semibold text-[#a43434]' : 'm-0 text-[0.95rem] text-[#576779]'} aria-live="polite">
          {!count ? 'Select one or more forms to fill.' : `${pluralize(count, 'form')} selected.`}
        </p>

        {!templates.length ? (
          <p className="rounded-[10px] border border-dashed border-[#bcc8d6] bg-[#f8fafb] p-3.5 text-[#576779]">No templates yet — create one in the Create Template tab.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3.5">
            {templates.map(template => {
              const selected = selectedFillIds.includes(template.id)
              const fieldCount =
                typeof template.field_count === 'number'
                  ? template.field_count
                  : template.fields?.schema?.properties
                    ? Object.keys(template.fields.schema.properties).length
                    : Object.keys(template.fields || {}).length
              return (

                <div
                  key={template.id}
                  className={selected ? 'relative flex min-h-[112px] cursor-pointer flex-col gap-1.5 rounded-xl border border-[#125a86] bg-[#eef7ff] p-4 shadow-[inset_0_0_0_1px_#125a86] transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#125a86]' : 'relative flex min-h-[112px] cursor-pointer flex-col gap-1.5 rounded-xl border border-[#d7dde3] bg-[#fbfcfe] p-4 transition hover:border-[#9ab1c7] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#125a86]'}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  onClick={() => toggleFillSelection(template.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleFillSelection(template.id)
                    }
                  }}
                >
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent p-0 text-base font-semibold leading-none text-[#576779] hover:border-[#f3d3d3] hover:bg-[#fbe9e9] hover:text-[#a43434]"
                    title="Delete template"
                    aria-label={`Delete ${template.name || 'Untitled'}`}
                    onClick={e => {
                      e.stopPropagation()
                      del.request(template)
                    }}
                    onKeyDown={e => e.stopPropagation()}
                  >
                    <TrashIcon />
                  </button>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-bold text-[#1f2a36] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden break-words">{template.name || 'Untitled'}</span>
                    <span className="text-[0.85rem] text-[#576779]">{pluralize(fieldCount, 'field')}</span>
                  </div>
                  <button
                    type="button"
                    className="mt-auto self-start rounded-lg border border-[#d7dde3] bg-transparent px-2.5 py-[5px] text-[0.82rem] font-semibold text-[#0b4568] hover:bg-[#e5ecf3]"
                    onClick={e => {
                      e.stopPropagation()
                      handleTilePreview(template.pdf_path || '')
                    }}
                  >
                    Preview
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <label htmlFor="fillModel" className="font-semibold">Extraction model</label>
        <select
          className="w-full rounded-[10px] border border-[#bcc8d6] bg-white px-3 py-2.5 text-[#1f2a36] focus:border-[#125a86] focus:outline-none focus:ring-2 focus:ring-[#125a86]"
          id="fillModel"
          value={model}
          onChange={e => setModel(e.target.value)}
        >
          {models.length === 0 ? (
            <option value="">(default model)</option>
          ) : (
            models.map(m => (
              <option key={m} value={m}>
                {m === defaultModel ? `${m} (default)` : m}
              </option>
            ))
          )}
        </select>

        <p><b>External APIs</b></p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="justify-self-start rounded-[10px] border border-[#d7dde3] bg-[#f1f5f9] px-3.5 py-2 font-semibold text-[#0b4568] hover:bg-[#e5ecf3] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setIsLocationOpen(true)}
          >
            Location
          </button>
          <button
            type="button"
            className="justify-self-start rounded-[10px] border border-[#d7dde3] bg-[#f1f5f9] px-3.5 py-2 font-semibold text-[#0b4568] hover:bg-[#e5ecf3] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setIsWeatherOpen(true)}
          >
            Weather
          </button>
          {weatherData && (
            <div className="mt-2 mb-4 inline-flex items-center gap-2 rounded-2xl border border-[#dadce0] bg-[#e6f4ea] px-3 py-1.5 text-[0.85rem] font-medium text-[#137333]">
              <span>✓ Weather data attached</span>
              <button
                type="button"
                className="inline-flex items-center px-1 text-[1.1rem] font-bold leading-none text-[#137333] hover:text-[#c5221f]"
                onClick={() => setWeatherData(null)}
                title="Remove weather data"
              >
                &times;
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          className={count === 0 ? 'cursor-not-allowed rounded-[10px] bg-[#c2ccd6] px-3.5 py-2.5 font-bold text-white' : 'rounded-[10px] bg-[#125a86] px-3.5 py-2.5 font-bold text-white hover:bg-[#0b4568]'}
        >
          {count > 1 ? `Fill ${count} Forms` : 'Fill Form'}
        </button>
      </form>

      <p className={status.type === 'success' ? 'm-0 min-h-[1.4em] text-[#1a7f4b]' : status.type === 'error' ? 'm-0 min-h-[1.4em] text-[#a43434]' : 'm-0 min-h-[1.4em] text-[#576779]'} aria-live="polite">
        {status.message}
      </p>
      {jsonResponse != null && (
        <pre className="m-0 max-h-[280px] overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-[#d7dde3] bg-[#f7fafc] px-3 py-2.5 font-mono text-[0.88rem]">{JSON.stringify(jsonResponse, null, 2)}</pre>
      )}

      <p className="m-0 text-[0.95rem] text-[#576779]">
        Submitted form data is stored locally on this device. Any personally
        identifiable information it contains stays on the machine running FireForm.
      </p>

      <WeatherModal
        isOpen={isWeatherOpen}
        onClose={() => setIsWeatherOpen(false)}
        onAgree={(data) => setWeatherData(data)}
        initialLatitude={initialWeatherLat}
        initialLongitude={initialWeatherLon}
      />

      <ZipcodeModal
        isOpen={isLocationOpen}
        onClose={() => setIsLocationOpen(false)}
        onFetchWeather={handleFetchWeatherFromLocation}
      />

      <ConfirmDialog
        isOpen={del.pending !== null}
        title="Delete this template?"
        message={
          <>
            You’re about to permanently delete{' '}
            <span className="font-semibold">{del.pending?.name || 'Untitled'}</span>. It will be
            removed from Fill Form and Templates, along with its saved submissions and generated
            PDFs. This can’t be undone.
          </>
        }
        busy={del.busy}
        error={del.error}
        onConfirm={del.confirm}
        onCancel={del.cancel}
      />
    </section>
  )
}
