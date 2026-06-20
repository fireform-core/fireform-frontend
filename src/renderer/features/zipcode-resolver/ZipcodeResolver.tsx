import { useState } from 'react'
import { fetchLocation } from '../../lib/api'

export interface ZipcodeModalProps {
  isOpen: boolean
  onClose: () => void
  onFetchWeather: (lat: number, lon: number) => void
}

const COUNTRIES = [
  {"label": "Andorra", "value": "ad"},
  {"label": "Argentina", "value": "ar"},
  {"label": "American Samoa", "value": "as"},
  {"label": "Austria", "value": "at"},
  {"label": "Australia", "value": "au"},
  {"label": "Åland Islands", "value": "ax"},
  {"label": "Azerbaijan", "value": "az"},
  {"label": "Bangladesh", "value": "bd"},
  {"label": "Belgium", "value": "be"},
  {"label": "Bulgaria", "value": "bg"},
  {"label": "Bermuda", "value": "bm"},
  {"label": "Brazil", "value": "br"},
  {"label": "Belarus", "value": "by"},
  {"label": "Canada", "value": "ca"},
  {"label": "Switzerland", "value": "ch"},
  {"label": "Chile", "value": "cl"},
  {"label": "Colombia", "value": "co"},
  {"label": "Costa Rica", "value": "cr"},
  {"label": "Cyprus", "value": "cy"},
  {"label": "Czechia", "value": "cz"},
  {"label": "Germany", "value": "de"},
  {"label": "Denmark", "value": "dk"},
  {"label": "Dominican Republic", "value": "do"},
  {"label": "Algeria", "value": "dz"},
  {"label": "Estonia", "value": "ee"},
  {"label": "Spain", "value": "es"},
  {"label": "Finland", "value": "fi"},
  {"label": "Federated States of Micronesia", "value": "fm"},
  {"label": "Faroe Islands", "value": "fo"},
  {"label": "France", "value": "fr"},
  {"label": "United Kingdom of Great Britain and Northern Ireland", "value": "gb"},
  {"label": "French Guiana", "value": "gf"},
  {"label": "Guernsey", "value": "gg"},
  {"label": "Greenland", "value": "gl"},
  {"label": "Guadeloupe", "value": "gp"},
  {"label": "Guatemala", "value": "gt"},
  {"label": "Guam", "value": "gu"},
  {"label": "Croatia", "value": "hr"},
  {"label": "Haiti", "value": "ht"},
  {"label": "Hungary", "value": "hu"},
  {"label": "Ireland", "value": "ie"},
  {"label": "Isle of Man", "value": "im"},
  {"label": "India", "value": "in"},
  {"label": "Iceland", "value": "is"},
  {"label": "Italy", "value": "it"},
  {"label": "Jersey", "value": "je"},
  {"label": "Japan", "value": "jp"},
  {"label": "Republic of Korea", "value": "kr"},
  {"label": "Liechtenstein", "value": "li"},
  {"label": "Sri Lanka", "value": "lk"},
  {"label": "Lithuania", "value": "lt"},
  {"label": "Luxembourg", "value": "lu"},
  {"label": "Latvia", "value": "lv"},
  {"label": "Monaco", "value": "mc"},
  {"label": "Republic of Moldova", "value": "md"},
  {"label": "Marshall Islands", "value": "mh"},
  {"label": "The former Yugoslav Republic of Macedonia", "value": "mk"},
  {"label": "Northern Mariana Islands", "value": "mp"},
  {"label": "Martinique", "value": "mq"},
  {"label": "Malta", "value": "mt"},
  {"label": "Malawi", "value": "mw"},
  {"label": "Mexico", "value": "mx"},
  {"label": "Malaysia", "value": "my"},
  {"label": "New Caledonia", "value": "nc"},
  {"label": "Netherlands", "value": "nl"},
  {"label": "Norway", "value": "no"},
  {"label": "New Zealand", "value": "nz"},
  {"label": "Peru", "value": "pe"},
  {"label": "Philippines", "value": "ph"},
  {"label": "Pakistan", "value": "pk"},
  {"label": "Poland", "value": "pl"},
  {"label": "Saint Pierre and Miquelon", "value": "pm"},
  {"label": "Puerto Rico", "value": "pr"},
  {"label": "Portugal", "value": "pt"},
  {"label": "Palau", "value": "pw"},
  {"label": "Réunion", "value": "re"},
  {"label": "Romania", "value": "ro"},
  {"label": "Serbia", "value": "rs"},
  {"label": "Russian Federation", "value": "ru"},
  {"label": "Sweden", "value": "se"},
  {"label": "Singapore", "value": "sg"},
  {"label": "Slovenia", "value": "si"},
  {"label": "Svalbard and Jan Mayen Islands", "value": "sj"},
  {"label": "Slovakia", "value": "sk"},
  {"label": "San Marino", "value": "sm"},
  {"label": "Thailand", "value": "th"},
  {"label": "Turkey", "value": "tr"},
  {"label": "Ukraine", "value": "ua"},
  {"label": "United States of America", "value": "us"},
  {"label": "Uruguay", "value": "uy"},
  {"label": "Holy See", "value": "va"},
  {"label": "United States Virgin Islands", "value": "vi"},
  {"label": "Wallis and Futuna Islands", "value": "wf"},
  {"label": "Mayotte", "value": "yt"},
  {"label": "South Africa", "value": "za"}
]

export function ZipcodeModal({ isOpen, onClose, onFetchWeather }: ZipcodeModalProps) {
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('us')
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

    if (!city.trim()) {
      setStatus({ message: 'City is required.', type: 'error' })
      return
    }

    try {
      setLoading(true)
      setStatus({ message: 'Fetching location data…', type: 'info' })
      const data = await fetchLocation(country, city.trim())
      setResults(data)
      setStatus({ message: 'Location data retrieved successfully.', type: 'success' })
    } catch (err: unknown) {
      setStatus({ message: (err as Error).message || 'Failed to fetch location data', type: 'error' })
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
              <div className="grid-2" style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="zc-city">City Name</label>
                  <input
                    id="zc-city"
                    type="text"
                    placeholder="e.g. Santa Cruz"
                    required
                    value={city}
                    onChange={e => setCity(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="zc-country">Country</label>
                  <select
                    id="zc-country"
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.value} value={c.value}>
                        {c.label} ({c.value.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" disabled={loading} style={{ alignSelf: 'flex-start' }}>
                {loading ? 'Fetching…' : 'Fetch Location Data'}
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
                          <td>{r.postal_code as string}</td>
                          <td>{r.place_name as string}</td>
                          <td>{r.state_name as string} {r.state_code ? `(${r.state_code})` : ''}</td>
                          <td>{r.county_name as string}</td>
                          <td>{r.latitude as number}</td>
                          <td>{r.longitude as number}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {results && results.length === 0 && (
              <p>No results found for {city}.</p>
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
