import { useEffect, useState } from 'react'
import { Cpu, Globe, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react'
import { useStore } from '../../store'
import { fetchModels, type ModelInfo } from '../../lib/api'
import { cn } from '../../lib/utils'

function SettingRow({
  label,
  description,
  children,
  disabled,
  badge,
}: {
  label: string
  description: string
  children: React.ReactNode
  disabled?: boolean
  badge?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-6 py-4 border-b border-zinc-100 last:border-0',
        disabled && 'opacity-50 pointer-events-none select-none'
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-800">{label}</span>
          {badge && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-1 mt-8 first:mt-0">
      <Icon className="w-3.5 h-3.5 text-zinc-400" />
      <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{title}</span>
    </div>
  )
}

export function Settings() {
  const selectedModel = useStore(s => s.selectedModel)
  const setSelectedModel = useStore(s => s.setSelectedModel)
  const modelDownload = useStore(s => s.modelDownload)
  const startModelDownload = useStore(s => s.startModelDownload)
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [selectedName, setSelectedName] = useState(selectedModel)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchModels()
      .then(res => {
        if (res?.models?.length) {
          setAvailableModels(res.models)
          const downloadingModel = modelDownload?.status === 'downloading'
            ? res.models.find(model => model.name === modelDownload.model)
            : undefined
          const installed = downloadingModel
            || res.models.find(model => model.name === selectedModel && model.installed)
            || res.models.find(model => model.name === res.default && model.installed)
            || res.models.find(model => model.installed)
          const initial = installed?.name || res.default || res.models[0].name
          setSelectedName(initial)
          if (!modelDownload && (!selectedModel || installed?.name !== selectedModel)) {
            setSelectedModel(initial)
          }
        }
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Unable to load models.'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!modelDownload || modelDownload.status === 'downloading') return
    if (modelDownload.status === 'error') {
      return
    }
    fetchModels()
      .then(res => setAvailableModels(res.models))
      .catch(err => setError(err instanceof Error ? err.message : 'Unable to refresh models.'))
  }, [modelDownload])

  const effectiveSelectedName = modelDownload?.status === 'downloading' || modelDownload?.status === 'success'
    ? modelDownload.model
    : modelDownload?.status === 'error'
      ? modelDownload.previousModel
      : selectedName
  const selectedInfo = availableModels.find(model => model.name === effectiveSelectedName)
  const downloading = modelDownload?.status === 'downloading'
  const progress = modelDownload?.progress
  const displayError = modelDownload?.status === 'error' ? modelDownload.error : error
  const percentage = progress?.completed != null && progress.total
    ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
    : 0

  const handleModelChange = (model: string) => {
    const info = availableModels.find(item => item.name === model)
    if (!info) return
    setError('')
    setSelectedName(model)
    if (info.installed) {
      setSelectedModel(model)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const handleDownload = () => {
    if (!selectedInfo || selectedInfo.installed || downloading) return
    setError('')
    void startModelDownload(selectedInfo.name, selectedModel)
  }

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 p-8">
      <div className="max-w-xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Settings</h1>
          <p className="text-sm text-zinc-400 mt-1">Configure FireForm to match your workflow.</p>
        </div>

        {/* ── AI Model ── */}
        <SectionHeader icon={Cpu} title="AI Model" />
        <div className="bg-white border border-zinc-200 rounded-xl px-5">
          <SettingRow
            label="LLM model"
            description="Local Ollama model used for AI form filling. Run ollama pull <model> to add more."
          >
            {loading ? (
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading…
              </div>
            ) : availableModels.length === 0 ? (
              <span className="text-xs text-red-500">{displayError || 'No models — is Ollama running?'}</span>
            ) : (
              <div className="flex flex-col items-end gap-2">
                <div className="relative">
                  <select
                    value={effectiveSelectedName}
                    disabled={downloading}
                    onChange={e => handleModelChange(e.target.value)}
                    className={cn(
                      'appearance-none rounded-lg border border-zinc-200 bg-zinc-50',
                      'pl-3 pr-8 py-1.5 text-sm font-mono text-zinc-800',
                      'hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-colors cursor-pointer'
                    )}
                  >
                    {availableModels.map(model => (
                      <option key={model.name} value={model.name}>{model.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-2 pointer-events-none" />
                </div>
                {selectedInfo && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className={selectedInfo.installed ? 'text-emerald-600' : 'text-amber-600'}>
                      {downloading && modelDownload?.model === selectedInfo.name
                        ? 'Downloading...'
                        : selectedInfo.installed ? 'Installed' : 'Not installed'}
                    </span>
                    {selectedInfo.recommended && <span className="text-zinc-400">· Recommended</span>}
                  </div>
                )}
                {selectedInfo && !selectedInfo.installed && !downloading && (
                  <button
                    type="button"
                    onClick={() => void handleDownload()}
                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
                  >
                    Download
                  </button>
                )}
                {downloading && modelDownload?.model === selectedInfo?.name && (
                  <div className="w-56" aria-live="polite">
                    <progress
                      className="w-full"
                      value={progress?.total ? percentage : undefined}
                      max={100}
                    />
                    <p className="mt-1 text-xs text-zinc-400">
                      {progress?.status || 'Downloading model…'}
                      {progress?.total ? ` (${percentage}%)` : ''}
                    </p>
                  </div>
                )}
                <span
                  className={cn(
                    'flex items-center gap-1 text-xs font-medium text-emerald-600 transition-all duration-300',
                    saved ? 'opacity-100' : 'opacity-0'
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved
                </span>
                {displayError && <p className="max-w-56 text-right text-xs text-red-500" role="alert">{displayError}</p>}
              </div>
            )}
          </SettingRow>
        </div>

        {/* ── Language & Region ── */}
        <SectionHeader icon={Globe} title="Language & Region" />
        <div className="bg-white border border-zinc-200 rounded-xl px-5">
          <SettingRow
            label="UI language"
            description="Change the language used across the FireForm interface."
            disabled
            badge="Coming soon"
          >
            <span className="text-sm text-zinc-300 font-medium">English (EN)</span>
          </SettingRow>

        </div>

      </div>
    </div>
  )
}
