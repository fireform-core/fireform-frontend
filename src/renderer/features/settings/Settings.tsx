import { useEffect, useState } from 'react'
import { Cpu, Globe, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react'
import { useStore } from '../../store'
import { fetchModels } from '../../lib/api'
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
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchModels()
      .then(res => {
        if (res?.models?.length) {
          setAvailableModels(res.models)
          if (!selectedModel) setSelectedModel(res.default || res.models[0])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleModelChange = (model: string) => {
    setSelectedModel(model)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
              <span className="text-xs text-red-500">No models — is Ollama running?</span>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={e => handleModelChange(e.target.value)}
                    className={cn(
                      'appearance-none rounded-lg border border-zinc-200 bg-zinc-50',
                      'pl-3 pr-8 py-1.5 text-sm font-mono text-zinc-800',
                      'hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-colors cursor-pointer'
                    )}
                  >
                    {availableModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-2 pointer-events-none" />
                </div>
                <span
                  className={cn(
                    'flex items-center gap-1 text-xs font-medium text-emerald-600 transition-all duration-300',
                    saved ? 'opacity-100' : 'opacity-0'
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved
                </span>
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
