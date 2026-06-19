import { useState } from 'react'
import { fetchWeatherForecast } from '../../lib/api'

export function WeatherForecast() {
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [status, setStatus] = useState({ message: '', type: '' })
  const [result, setResult] = useState<Record<string, unknown> | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    setStatus({ message: '', type: '' })

    const lat = parseFloat(latitude)
    const lon = parseFloat(longitude)

    if (isNaN(lat) || isNaN(lon)) {
      setStatus({ message: 'Latitude and Longitude must be valid numbers.', type: 'error' })
      return
    }

    try {
      setStatus({ message: 'Fetching weather data…', type: 'info' })
      const data = await fetchWeatherForecast(lat, lon)
      setStatus({ message: 'Weather data retrieved successfully.', type: 'success' })
      setResult(data)
    } catch (err: unknown) {
      setStatus({ message: (err as Error).message, type: 'error' })
    }
  }

  return (
    <section className="panel card">
      <h2>Weather Forecast</h2>
      <p className="helper">
        Input latitude and longitude to get the current weather from Open-Meteo.
      </p>
      <form className="stacked-form" onSubmit={handleSubmit}>
        <div className="grid-2">
          <div>
            <label htmlFor="latitude">Latitude</label>
            <input
              id="latitude"
              type="number"
              step="any"
              placeholder="52.52"
              required
              value={latitude}
              onChange={e => setLatitude(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="longitude">Longitude</label>
            <input
              id="longitude"
              type="number"
              step="any"
              placeholder="13.41"
              required
              value={longitude}
              onChange={e => setLongitude(e.target.value)}
            />
          </div>
        </div>
        <button type="submit">Get Weather</button>
      </form>

      <p
        className={`status${status.type ? ` ${status.type}` : ''}`}
        aria-live="polite"
      >
        {status.message}
      </p>

      {result != null && (
        <pre className="json-output">{JSON.stringify(result, null, 2)}</pre>
      )}
    </section>
  )
}
