import { useState } from 'react'
import { fetchAddressLookup } from '../../lib/api'

export interface ZipcodeModalProps {
  isOpen: boolean
  onClose: () => void
  onFetchWeather: (lat: number, lon: number) => void
}

export function ZipcodeModal({ isOpen, onClose, onFetchWeather }: ZipcodeModalProps) {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState({ message: '', type: '' })
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

  if (!isOpen) return null

  function toggleRow(i: number) {
    const newSet = new Set(selectedRows)
    if (newSet.has(i)) newSet.delete(i)
    else newSet.add(i)
    setSelectedRows(newSet)
  }

  async function handleFetch(e: React.FormEvent) {
    e.preventDefault()
    setResults(null)
    setSelectedRows(new Set())
    setStatus({ message: '', type: '' })

    if (!address.trim()) {
      setStatus({ message: 'Address is required.', type: 'error' })
      return
    }

    try {
      setLoading(true)
      setStatus({ message: 'Looking up address…', type: 'info' })
      const data = await fetchAddressLookup(address.trim())
      setResults(data)
      if (data.length === 0) {
        setStatus({ message: 'No results found for this address.', type: 'error' })
      } else {
        setStatus({ message: `Found ${data.length} result${data.length > 1 ? 's' : ''}.`, type: 'success' })
      }
    } catch (err: unknown) {
      setStatus({ message: (err as Error).message || 'Failed to look up address.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function handleFetchWeather() {
    if (!results) return
    if (selectedRows.size !== 1) {
      setStatus({ message: 'Please select exactly one row to fetch weather data.', type: 'error' })
      return
    }
    const rowIndex = Array.from(selectedRows)[0]
    const row = results[rowIndex]
    const lat = row.latitude as number
    const lon = row.longitude as number
    onFetchWeather(lat, lon)
  }

  function handleDiscard() {
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content large" role="dialog" aria-modal="true" aria-labelledby="zipcode-modal-title">
        <div className="modal-body">
          <button className="modal-close-btn" onClick={handleDiscard} aria-label="Close modal">
            &times;
          </button>
          <h2 id="zipcode-modal-title">Zipcode / Location Resolver</h2>

          <div className="weather-forecast-container">
            <form className="stacked-form" onSubmit={handleFetch}>
              <div>
                <label htmlFor="zc-address">Address</label>
                <input
                  id="zc-address"
                  type="text"
                  placeholder="e.g. 1600 Amphitheatre Parkway, Mountain View, CA, US"
                  required
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  style={{ width: '100%' }}
                />
                <p style={{ margin: '4px 0 0', fontSize: '0.8em', opacity: 0.65 }}>
                  Include city, state/region, and country for best results.
                </p>
              </div>

              <button type="submit" disabled={loading} style={{ alignSelf: 'flex-start' }}>
                {loading ? 'Looking up…' : 'Look Up Address'}
              </button>
            </form>

            <p className={`status${status.type ? ` ${status.type}` : ''}`} aria-live="polite">
              {status.message}
            </p>

            {results && results.length > 0 && (
              <div className="weather-results" style={{ marginTop: '20px' }}>
                <h3>Results</h3>
                <div className="weather-table-wrap">
                  <table className="weather-table">
                    <thead>
                      <tr>
                        <th>Select</th>
                        <th>Postal Code</th>
                        <th>Place Name</th>
                        <th>State</th>
                        <th>County</th>
                        <th>Country</th>
                        <th>Latitude</th>
                        <th>Longitude</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={i} className={selectedRows.has(i) ? 'selected-row' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedRows.has(i)}
                              onChange={() => toggleRow(i)}
                            />
                          </td>
                          <td>{(r.postal_code as string) ?? '—'}</td>
                          <td>{r.place_name as string}</td>
                          <td>{(r.state as string) ?? '—'}</td>
                          <td>{(r.county as string) ?? '—'}</td>
                          <td>{(r.country as string) ?? '—'}</td>
                          <td>{r.latitude as number}</td>
                          <td>{r.longitude as number}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {selectedRows.size > 1 && (
            <p className="helper error" style={{ margin: 0, textAlign: 'right' }}>
              Fetching weather data is only possible for a single location.
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
            <button
              type="button"
              className="secondary-btn"
              onClick={handleDiscard}
            >
              Discard
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={handleFetchWeather}
              disabled={!results || selectedRows.size !== 1}
            >
              Fetch weather for selected location
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
