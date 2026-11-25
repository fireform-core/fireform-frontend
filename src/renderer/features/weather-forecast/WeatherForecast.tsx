import { useState, useEffect } from 'react'
import {
  CloudSun,
  X,
  RotateCw,
  Send,
} from 'lucide-react'
import { fetchWeatherForecast } from '../../lib/api'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { cn } from '../../lib/utils'
import { useTranslation } from '../../lib/i18n'

const FIELD_LABELS_ES: Record<string, string> = {
  temperature_2m: 'Temperatura (2 m)',
  apparent_temperature: 'Temperatura Aparente',
  relative_humidity_2m: 'Humedad Relativa',
  precipitation: 'Precipitación',
  precipitation_probability: 'Probabilidad de Precipitación',
  rain: 'Lluvia',
  wind_speed_10m: 'Velocidad del Viento (10 m)',
  wind_direction_10m: 'Dirección del Viento (10 m)',
  soil_temperature_0cm: 'Temperatura del Suelo',
}

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
] as const

type FieldKey = (typeof FIELD_CATALOGUE)[number]['key']

interface WeatherResult {
  latitude: number
  longitude: number
  hourly?: {
    time?: string[]
    [key: string]: unknown
  }
}

function serializeWeatherData(
  data: WeatherResult,
  activeFields: Array<(typeof FIELD_CATALOGUE)[number]>,
  language: string = 'en'
): string {
  const isEs = language === 'es'
  if (!data.hourly || !Array.isArray(data.hourly.time)) {
    return isEs ? 'No se devolvieron datos horarios.' : 'No hourly data returned.'
  }

  const times = data.hourly.time
  let text = isEs
    ? `Latitud: ${data.latitude}, Longitud: ${data.longitude}\n`
    : `Latitude: ${data.latitude}, Longitude: ${data.longitude}\n`
  text += isEs ? `Métricas horarias registradas:\n` : `Recorded hourly metrics:\n`

  times.forEach((t: string, idx: number) => {
    const formattedTime = t.replace('T', ' ')
    const values = activeFields
      .map(f => {
        const val = (data.hourly?.[f.key] as (number | null)[])?.[idx]
        const label = isEs ? (FIELD_LABELS_ES[f.key] || f.label) : f.label
        if (val === null || val === undefined) return `${label}: N/A`
        return `${label}: ${val} ${f.unit}`
      })
      .join(', ')
    text += `[${formattedTime}] ${values}\n`
  })
  return text
}

// ─── Modal / Standalone Component ──────────────────────────────────────────

export interface WeatherModalProps {
  isOpen: boolean
  onClose: () => void
  onAgree: (weatherText: string) => void
  initialLatitude?: number
  initialLongitude?: number
}

export function WeatherModal({
  isOpen,
  onClose,
  onAgree,
  initialLatitude,
  initialLongitude,
}: WeatherModalProps) {
  const { t, language } = useTranslation()
  const isEs = language === 'es'
  const [latitude, setLatitude] = useState(initialLatitude ? String(initialLatitude) : '')
  const [longitude, setLongitude] = useState(initialLongitude ? String(initialLongitude) : '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sameDay, setSameDay] = useState(false)
  const [selected, setSelected] = useState<Set<FieldKey>>(
    new Set(FIELD_CATALOGUE.map(f => f.key))
  )
  const [status, setStatus] = useState({ message: '', type: '' })
  const [result, setResult] = useState<WeatherResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialLatitude !== undefined) setLatitude(String(initialLatitude))
    if (initialLongitude !== undefined) setLongitude(String(initialLongitude))
  }, [initialLatitude, initialLongitude])

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
      setStatus({ message: t.weather.selectMetricError, type: 'error' })
      return
    }

    const lat = parseFloat(latitude)
    const lon = parseFloat(longitude)
    const start = startDate
    const end = sameDay ? startDate : endDate

    if (isNaN(lat) || isNaN(lon)) {
      setStatus({ message: t.weather.validNumbersError, type: 'error' })
      return
    }

    if (!start || (!sameDay && !end)) {
      setStatus({ message: t.weather.specifyDatesError, type: 'error' })
      return
    }

    if (!sameDay && start > end) {
      setStatus({ message: t.weather.dateOrderError, type: 'error' })
      return
    }

    try {
      setLoading(true)
      setStatus({ message: t.weather.querying, type: 'info' })
      const data = await fetchWeatherForecast(lat, lon, start, end, Array.from(selected))
      setResult(data as unknown as WeatherResult)
      setStatus({ message: t.weather.success, type: 'success' })
    } catch (err: unknown) {
      setStatus({ message: (err as Error).message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const activeFields = FIELD_CATALOGUE.filter(f => selected.has(f.key))

  function handleAgree() {
    if (result) {
      const serialized = serializeWeatherData(result, activeFields, language)
      onAgree(serialized)
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <CloudSun className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900">{t.weather.headerTitle}</h2>
              <p className="text-[11px] text-zinc-500">
                {t.weather.headerSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Coordinates Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-mono text-zinc-500 font-bold block mb-1">
                  {t.weather.latitude}
                </label>
                <Input
                  type="number"
                  step=".0001"
                  placeholder="e.g. 40.7128"
                  required
                  value={latitude}
                  onChange={e => setLatitude(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-mono text-zinc-500 font-bold block mb-1">
                  {t.weather.longitude}
                </label>
                <Input
                  type="number"
                  step=".0001"
                  placeholder="e.g. -74.0060"
                  required
                  value={longitude}
                  onChange={e => setLongitude(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-mono text-zinc-500 font-bold block mb-1">
                  {t.weather.startDate}
                </label>
                <Input
                  type="date"
                  required
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-mono text-zinc-500 font-bold block mb-1">
                  {t.weather.endDate}
                </label>
                <Input
                  type="date"
                  disabled={sameDay}
                  required={!sameDay}
                  value={sameDay ? startDate : endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sameDayCheckbox"
                checked={sameDay}
                onChange={e => setSameDay(e.target.checked)}
                className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <label htmlFor="sameDayCheckbox" className="text-xs text-zinc-700 cursor-pointer">
                {t.weather.singleDay}
              </label>
            </div>

            {/* Weather Metrics Checklist */}
            <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50/50 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-zinc-200">
                <span className="text-[10px] uppercase font-mono text-zinc-500 font-bold">
                  {t.weather.selectVariables} ({selected.size} of {FIELD_CATALOGUE.length})
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-[11px] text-zinc-600 hover:text-zinc-950 underline font-medium"
                  >
                    {t.weather.selectAll}
                  </button>
                  <span className="text-zinc-300">•</span>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="text-[11px] text-zinc-600 hover:text-zinc-950 underline font-medium"
                  >
                    {t.weather.deselectAll}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {FIELD_CATALOGUE.map(field => {
                  const isChecked = selected.has(field.key)
                  const label = isEs ? (FIELD_LABELS_ES[field.key] || field.label) : field.label
                  return (
                    <label
                      key={field.key}
                      className={cn(
                        'flex items-center gap-2 p-1.5 rounded border text-xs cursor-pointer transition-colors',
                        isChecked
                          ? 'bg-white border-zinc-400 font-medium text-zinc-950 shadow-xs'
                          : 'bg-transparent border-transparent text-zinc-500 hover:bg-zinc-100'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleField(field.key)}
                        className="rounded border-zinc-300 text-zinc-900"
                      />
                      <span className="truncate flex-1">{label}</span>
                      <span className="font-mono text-[10px] text-zinc-400">{field.unit}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs h-9 font-semibold"
            >
              {loading ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  {t.weather.fetching}
                </>
              ) : (
                <>
                  <CloudSun className="w-3.5 h-3.5 mr-1.5" />
                  {t.weather.fetchWeather}
                </>
              )}
            </Button>
          </form>

          {/* Status Message */}
          {status.message && (
            <div
              className={`p-2.5 rounded-md text-xs flex items-center gap-2 ${
                status.type === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : status.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-zinc-100 border border-zinc-200 text-zinc-700'
              }`}
            >
              <span>{status.message}</span>
            </div>
          )}

          {/* Weather Results Preview */}
          {result && result.hourly && (
            <div className="space-y-2 border border-zinc-200 rounded-lg p-3 bg-zinc-50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase font-mono text-zinc-800">
                  {t.weather.retrievedTimeline} ({result.hourly.time?.length ?? 0} {t.weather.dataPoints})
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {activeFields.length} {t.weather.metrics}
                </Badge>
              </div>

              <div className="max-h-48 overflow-auto border border-zinc-200 rounded bg-white">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-zinc-100 border-b border-zinc-200 text-zinc-600 font-mono text-[10px]">
                    <tr>
                      <th className="p-2">{t.weather.timestamp}</th>
                      {activeFields.map(f => {
                        const label = isEs ? (FIELD_LABELS_ES[f.key] || f.label) : f.label
                        return (
                          <th key={f.key} className="p-2 whitespace-nowrap">
                            {label} ({f.unit})
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-mono text-[11px]">
                    {result.hourly.time?.slice(0, 12).map((t, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50">
                        <td className="p-2 font-semibold text-zinc-700">{t.replace('T', ' ')}</td>
                        {activeFields.map(f => {
                          const val = (result.hourly?.[f.key] as (number | null)[])?.[idx]
                          return (
                            <td key={f.key} className="p-2 text-zinc-900">
                              {val !== null && val !== undefined ? val : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose} className="bg-white text-xs">
            {t.weather.close}
          </Button>

          {result && (
            <Button
              onClick={handleAgree}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 shadow-xs"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {t.weather.insertNarrative}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
