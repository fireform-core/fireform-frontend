import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { useSpeechRecording } from './hooks'
import { fillTemplate, fetchModels } from '../../lib/api'
import { saveLastOutputPath } from '../../lib/storage'
import { pluralize } from '../../lib/utils'
import { TYPE_VALUE_TO_LABEL } from '../../lib/constants'
import { WeatherModal } from '../weather-forecast/WeatherForecast'
import { ZipcodeModal } from '../zipcode-resolver/ZipcodeResolver'

export function FillForm() {
  const { templates, selectedFillIds, toggleFillSelection, setActiveTab, setPreviewPath } =
    useStore(s => ({
      templates: s.templates,
      selectedFillIds: s.selectedFillIds,
      toggleFillSelection: s.toggleFillSelection,
      setActiveTab: s.setActiveTab,
      setPreviewPath: s.setPreviewPath,
    }))

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

  return (
    <section className="panel card">
      <h2>Fill Form</h2>
      <form className="stacked-form" onSubmit={handleSubmit}>
        <label htmlFor="inputText">Incident Input Text</label>

        <div className={`stt-controls${isRecording ? ' is-recording' : ''}${isPaused ? ' is-paused' : ''}`}>
          <button
            type="button"
            className="secondary-btn stt-btn"
            disabled={isRecording || isPaused || isTranscribing}
            onClick={start}
          >
            <span className="stt-dot" aria-hidden="true" />
            Record
          </button>
          <button
            type="button"
            className="secondary-btn stt-btn"
            disabled={!isRecording && !isPaused}
            onClick={togglePause}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            className="secondary-btn stt-btn"
            disabled={!isRecording && !isPaused}
            onClick={stop}
          >
            Stop &amp; Transcribe
          </button>
          <span className="stt-status" aria-live="polite">
            {sttStatus}
          </span>
        </div>

        <textarea
          id="inputText"
          rows={6}
          placeholder="Describe the incident using natural language, or use the recorder above..."
          value={inputText}
          onChange={e => setInputText(e.target.value)}
        />

        <label>Forms to fill</label>
        <p className={`helper${selectionError ? ' error' : ''}`} aria-live="polite">
          {!count ? 'Select one or more forms to fill.' : `${pluralize(count, 'form')} selected.`}
        </p>

        {!templates.length ? (
          <p className="empty-state">No templates yet — create one in the Create Template tab.</p>
        ) : (
          <div className="template-tiles">
            {templates.map(template => {
              const selected = selectedFillIds.includes(template.id)
              const fieldCount = Object.keys(template.fields || {}).length
              return (
                <div
                  key={template.id}
                  className={`template-tile${selected ? ' selected' : ''}`}
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
                  <div className="tile-body">
                    <span className="tile-title">{template.name || 'Untitled'}</span>
                    <span className="tile-meta">{pluralize(fieldCount, 'field')}</span>
                  </div>
                  <button
                    type="button"
                    className="tile-preview-btn"
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

        <label htmlFor="fillModel">Extraction model</label>
        <select
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

        <div className="horizontal-layout">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setIsLocationOpen(true)}
          >
            Location
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setIsWeatherOpen(true)}
          >
            Weather
          </button>
          {weatherData && (
            <div className="weather-attachment-badge">
              <span>✓ Weather data attached</span>
              <button
                type="button"
                className="remove-btn"
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
          className={count === 0 ? 'is-disabled' : ''}
        >
          {count > 1 ? `Fill ${count} Forms` : 'Fill Form'}
        </button>
      </form>

      <p className={`status${status.type ? ` ${status.type}` : ''}`} aria-live="polite">
        {status.message}
      </p>
      {jsonResponse != null && (
        <pre className="json-output">{JSON.stringify(jsonResponse, null, 2)}</pre>
      )}

      <p className="pii-notice">
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
    </section>
  )
}
