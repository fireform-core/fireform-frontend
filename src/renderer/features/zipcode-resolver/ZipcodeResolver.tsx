import { useState, useEffect, useRef } from 'react'
import {
  MapPin,
  Search,
  CloudSun,
  X,
  RotateCw,
  Navigation,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { fetchAddressLookup } from '../../lib/api'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { cn } from '../../lib/utils'

// Extend window to access the Leaflet global loaded via CDN in index.html
declare const L: any

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

  // Leaflet comes from a CDN <script>; it is missing when the app starts offline
  const leafletLoaded = typeof L !== 'undefined'
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)

  // Initialise the map when the modal opens
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || mapInstanceRef.current || !leafletLoaded) return

    const map = L.map(mapContainerRef.current).setView([20, 0], 2)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    markersLayerRef.current = L.layerGroup().addTo(map)
    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markersLayerRef.current = null
    }
  }, [isOpen, leafletLoaded])

  // When results change, drop pins and fit the map
  useEffect(() => {
    const map = mapInstanceRef.current
    const markers = markersLayerRef.current
    if (!map || !markers) return

    markers.clearLayers()

    if (!results || results.length === 0) {
      map.setView([20, 0], 2)
      return
    }

    const latLngs: [number, number][] = []
    results.forEach(r => {
      const lat = r.latitude as number
      const lon = r.longitude as number
      latLngs.push([lat, lon])

      const label = [r.place_name, r.state, r.country].filter(Boolean).join(', ')
      const popup = `
        <div style="font-family: sans-serif; font-size: 11px;">
          <strong>${label || 'Location'}</strong><br/>
          ${r.postal_code ? `Postal Code: <b>${r.postal_code}</b><br/>` : ''}
          <span style="font-family: monospace; color: #52525b;">${lat.toFixed(4)}, ${lon.toFixed(4)}</span>
        </div>
      `
      L.marker([lat, lon]).bindPopup(popup).addTo(markers)
    })

    if (latLngs.length === 1) {
      map.setView(latLngs[0], 13)
    } else {
      map.fitBounds(latLngs, { padding: [30, 30] })
    }
  }, [results])

  if (!isOpen) return null

  function toggleRow(i: number) {
    const newSet = new Set<number>()
    // Single selection for weather lookup
    newSet.add(i)
    setSelectedRows(newSet)

    const map = mapInstanceRef.current
    if (map && results) {
      const row = results[i]
      map.setView([row.latitude as number, row.longitude as number], 13)
    }
  }

  async function handleFetch(e: React.FormEvent) {
    e.preventDefault()
    setResults(null)
    setSelectedRows(new Set())
    setStatus({ message: '', type: '' })

    if (!address.trim()) {
      setStatus({ message: 'Address or zipcode is required.', type: 'error' })
      return
    }

    try {
      setLoading(true)
      setStatus({ message: 'Geocoding location coordinates…', type: 'info' })
      const data = await fetchAddressLookup(address.trim())
      setResults(data)
      if (data.length === 0) {
        setStatus({ message: 'No coordinates found for this query.', type: 'error' })
      } else {
        setStatus({ message: `Found ${data.length} geographic match${data.length > 1 ? 'es' : ''}.`, type: 'success' })
        // Auto-select first result
        setSelectedRows(new Set([0]))
      }
    } catch (err: unknown) {
      setStatus({ message: (err as Error).message || 'Failed to resolve address.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function handleFetchWeather() {
    if (!results) return
    const rowIndex = Array.from(selectedRows)[0] ?? 0
    const row = results[rowIndex]
    const lat = row.latitude as number
    const lon = row.longitude as number
    onFetchWeather(lat, lon)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <MapPin className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900">Address & Zipcode Geocoding</h2>
              <p className="text-[11px] text-zinc-500">
                Resolve municipal fire zones, GPS coordinates, and postal districts.
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

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <form onSubmit={handleFetch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
              <Input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="e.g. 123 Main St, Albany, NY or 10001"
                className="pl-8 text-xs bg-white"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs h-8 px-4 font-semibold"
            >
              {loading ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Resolving…
                </>
              ) : (
                <>
                  <Navigation className="w-3.5 h-3.5 mr-1.5" />
                  Lookup Address
                </>
              )}
            </Button>
          </form>

          {/* Interactive Leaflet Map Container */}
          <div className="border border-zinc-200 rounded-lg overflow-hidden h-48 bg-zinc-100 shadow-inner relative">
            {leafletLoaded ? (
              <div ref={mapContainerRef} className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-4 text-center text-xs text-zinc-500">
                Map unavailable: the map library could not be loaded (are you offline?). Address
                lookup still works.
              </div>
            )}
          </div>

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
              {status.type === 'error' ? (
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span>{status.message}</span>
            </div>
          )}

          {/* Geocoded Results Table */}
          {results && results.length > 0 && (
            <div className="space-y-2 border border-zinc-200 rounded-lg p-3 bg-zinc-50">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase font-mono text-zinc-800">
                  Resolved Geographic Matches ({results.length})
                </span>
                <span className="text-[10px] text-zinc-500">Click a row to center pin</span>
              </div>

              <div className="max-h-48 overflow-auto border border-zinc-200 rounded bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 border-b border-zinc-200 text-zinc-600 font-mono text-[10px] uppercase">
                    <tr>
                      <th className="p-2 w-10 text-center">Select</th>
                      <th className="p-2">Postal Code</th>
                      <th className="p-2">Place Name</th>
                      <th className="p-2">State / Region</th>
                      <th className="p-2">Country</th>
                      <th className="p-2 font-mono">Coordinates</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-mono text-[11px]">
                    {results.map((r, i) => {
                      const isSelected = selectedRows.has(i)
                      return (
                        <tr
                          key={i}
                          onClick={() => toggleRow(i)}
                          className={cn(
                            'cursor-pointer transition-colors',
                            isSelected ? 'bg-zinc-900 text-white font-medium' : 'hover:bg-zinc-50 text-zinc-800'
                          )}
                        >
                          <td className="p-2 text-center">
                            <input
                              type="radio"
                              name="selectedLocation"
                              checked={isSelected}
                              onChange={() => toggleRow(i)}
                              className="accent-zinc-900"
                            />
                          </td>
                          <td className="p-2 font-bold">{((r.postal_code as string) || '—')}</td>
                          <td className="p-2 font-sans font-medium">{r.place_name as string}</td>
                          <td className="p-2 font-sans text-xs">{(r.state as string) || '—'}</td>
                          <td className="p-2 font-sans text-xs">{(r.country as string) || '—'}</td>
                          <td className="p-2 font-mono text-[10px]">
                            {(r.latitude as number).toFixed(4)}, {(r.longitude as number).toFixed(4)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-3 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose} className="bg-white text-xs">
            Cancel
          </Button>

          {results && results.length > 0 && (
            <Button
              onClick={handleFetchWeather}
              className="bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs h-8 shadow-xs"
            >
              <CloudSun className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
              Fetch Weather for Selected Coordinates
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
