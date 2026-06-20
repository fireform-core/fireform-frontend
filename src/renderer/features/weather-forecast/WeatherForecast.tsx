import { useState } from 'react'
import { fetchWeatherForecast } from '../../lib/api'

// ─── Field catalogue ────────────────────────────────────────────────────────

const FIELD_CATALOGUE = [
  {
    key: 'temperature_2m',
    label: 'Temperature (2 m)',
    unit: '°C',
    description: 'Air temperature at 2 m above ground',
  },
  {
    key: 'apparent_temperature',
    label: 'Apparent Temperature',
    unit: '°C',
    description: 'Felt-like temperature (wind chill / heat index)',
  },
  {
    key: 'relative_humidity_2m',
    label: 'Relative Humidity',
    unit: '%',
    description: 'Relative humidity at 2 m',
  },
  {
    key: 'precipitation',
    label: 'Precipitation',
    unit: 'mm',
    description: 'Total precipitation (rain + snow)',
  },
  {
    key: 'precipitation_probability',
    label: 'Precipitation Probability',
    unit: '%',
    description: 'Probability of precipitation',
  },
  {
    key: 'rain',
    label: 'Rain',
    unit: 'mm',
    description: 'Rain from large-scale weather',
  },
  {
    key: 'wind_speed_10m',
    label: 'Wind Speed (10 m)',
    unit: 'km/h',
    description: 'Wind speed at 10 m above ground',
  },
  {
    key: 'wind_direction_10m',
    label: 'Wind Direction (10 m)',
    unit: '°',
    description: 'Wind direction at 10 m',
  },
  {
    key: 'soil_temperature_0cm',
    label: 'Soil Temperature',
    unit: '°C',
    description: 'Soil temperature at the surface',
  },
  {
    key: 'uv_index',
    label: 'UV Index',
    unit: '',
    description: 'UV index (clear sky)',
  },
] as const

type FieldKey = typeof FIELD_CATALOGUE[number]['key']

// ─── Result types ────────────────────────────────────────────────────────────

type HourlyData = { date: string[] } & Partial<Record<FieldKey, number[]>>

interface WeatherResult {
  latitude: number
  longitude: number
  elevation: number
  hourly: HourlyData
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(val: number | undefined, unit: string): string {
  if (val === undefined || val === null || Number.isNaN(val)) return '—'
  return `${val.toFixed(1)}${unit ? '\u202f' + unit : ''}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function serializeWeatherData(result: WeatherResult, activeFields: typeof FIELD_CATALOGUE[number][]): string {
  let text = `Weather Forecast at coordinates (${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}), Elevation: ${result.elevation}m:\n`
  result.hourly.date.forEach((dateStr, i) => {
    const formattedTime = formatDate(dateStr)
    const values = activeFields.map(f => {
      const val = result.hourly[f.key]?.[i]
      return `${f.label}: ${fmt(val, f.unit)}`
    }).join(', ')
    text += `[${formattedTime}] ${values}\n`
  })
  return text
}

// ─── Component ───────────────────────────────────────────────────────────────

interface WeatherModalProps {
  isOpen: boolean
  onClose: () => void
  onAgree: (weatherText: string) => void
}

export function WeatherModal({ isOpen, onClose, onAgree }: WeatherModalProps) {
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [selected, setSelected] = useState<Set<FieldKey>>(
    new Set(FIELD_CATALOGUE.map(f => f.key))
  )
  const [status, setStatus] = useState({ message: '', type: '' })
  const [result, setResult] = useState<WeatherResult | null>(null)
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  function toggleField(key: FieldKey) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(FIELD_CATALOGUE.map(f => f.key)))
  }

  function deselectAll() {
    setSelected(new Set())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    setStatus({ message: '', type: '' })

    if (selected.size === 0) {
      setStatus({ message: 'Please select at least one field.', type: 'error' })
      return
    }

    const lat = parseFloat(latitude)
    const lon = parseFloat(longitude)
    if (isNaN(lat) || isNaN(lon)) {
      setStatus({ message: 'Latitude and Longitude must be valid numbers.', type: 'error' })
      return
    }

    try {
      setLoading(true)
      setStatus({ message: 'Fetching weather data…', type: 'info' })
      const data = await fetchWeatherForecast(lat, lon, Array.from(selected))
      setResult(data as unknown as WeatherResult)
      setStatus({ message: 'Weather data retrieved successfully.', type: 'success' })
    } catch (err: unknown) {
      setStatus({ message: (err as Error).message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const activeFields = FIELD_CATALOGUE.filter(f => selected.has(f.key))

  function handleAgree() {
    if (result) {
      const serialized = serializeWeatherData(result, activeFields)
      onAgree(serialized)
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content weather-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          &times;
        </button>

        <div className="modal-body">
          {/* ── Header ── */}
          <div className="weather-header">
            <div>
              <h2>Weather Forecast</h2>
              <p className="helper">
                Enter coordinates and choose which hourly variables to download via Open-Meteo.
              </p>
            </div>
          </div>

          {/* ── Coordinate inputs ── */}
          <form className="stacked-form" onSubmit={handleSubmit}>
            <div className="grid-2" style={{ margin: '10px 0 0 0' }}>
              <div>
                <label htmlFor="wf-latitude">Latitude</label>
                <input
                  id="wf-latitude"
                  type="number"
                  step=".001"
                  placeholder="e.g. 41.3851"
                  required
                  value={latitude}
                  onChange={e => setLatitude(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="wf-longitude">Longitude</label>
                <input
                  id="wf-longitude"
                  type="number"
                  step=".001"
                  placeholder="e.g. 2.1734"
                  required
                  value={longitude}
                  onChange={e => setLongitude(e.target.value)}
                />
              </div>
            </div>

            {/* ── Field selector ── */}
            <div className="field-selector-section">
              <div className="field-selector-header">
                <div className="grid-2" style={{ display: "flex", gap: "10px", margin: '10px 0 10px 0' }}>
                  <div>
                    <label htmlFor="wf-from">From</label>
                    <input id="wf-from" aria-label="Date" type="date" />
                  </div>
                  <div>
                    <label htmlFor="wf-to">To</label>
                    <input id="wf-to" aria-label="Date" type="date" />
                  </div>
                </div>

                <div className="field-selector-actions" style={{ margin: '20px 0 10px 0', display: "flex", gap: "10px" }}>
                  <button type="button" className="selector-ctrl-btn" onClick={selectAll}>
                    Select all
                  </button>
                  <button type="button" className="selector-ctrl-btn" onClick={deselectAll}>
                    Clear all
                  </button>
                </div>
              </div>
              <div className="tabs">
                {FIELD_CATALOGUE.map(field => {
                  const active = selected.has(field.key)
                  return (
                    <button
                      key={field.key}
                      type="button"
                      className={`tab${active ? ' active' : ''}`}
                      onClick={() => toggleField(field.key)}
                      title={field.description}
                      aria-pressed={active}
                    >
                      {field.label}
                      {field.unit && <span className="tab-unit"> ({field.unit})</span>}
                    </button>
                  )
                })}
              </div>
              <p className="helper">
                {selected.size === 0
                  ? 'No fields selected — select at least one.'
                  : `${selected.size} / ${FIELD_CATALOGUE.length} field${selected.size === 1 ? '' : 's'} selected`}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || selected.size === 0}
              style={{ margin: '10px 0 0 0' }}
            >
              {loading ? 'Fetching…' : 'Get Weather'}
            </button>
          </form>

          {/* ── Status line ── */}
          <p className={`status${status.type ? ` ${status.type}` : ''}`} aria-live="polite">
            {status.message}
          </p>

          {/* ── Results table ── */}
          {result && (
            <div className="weather-results-container">
              <div className="weather-results">
                {/* Meta strip */}
                <div className="weather-meta-strip">
                  <span>{result.latitude.toFixed(4)}°N, {result.longitude.toFixed(4)}°E</span>
                  <span>{result.elevation.toFixed(0)} m asl</span>
                </div>

                <div className="weather-table-wrap">
                  <table className="weather-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        {activeFields.map(f => (
                          <th key={f.key}>
                            {f.label}
                            {f.unit && <span className="th-unit"> ({f.unit})</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.hourly.date.map((dateStr, i) => (
                        <tr key={dateStr}>
                          <td className="time-cell">{formatDate(dateStr)}</td>
                          {activeFields.map(f => (
                            <td key={f.key} className="data-cell">
                              {fmt(result.hourly[f.key]?.[i], f.unit)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer for Agree/Disagree Actions */}
        {result && (
          <div className="modal-footer">
            <button type="button" className="primary-btn" onClick={handleAgree} style={{ flex: 1 }}>
              Attach Data to Form
            </button>
            <button type="button" className="secondary-btn" onClick={onClose} style={{ flex: 1 }}>
              Discard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
