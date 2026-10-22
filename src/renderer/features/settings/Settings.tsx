import { Cpu, Globe } from 'lucide-react'
import { ModelSelector } from '../../components/ModelSelector'
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
      <div className="w-full max-w-sm flex-shrink-0">{children}</div>
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
  return (
    <div className="flex-1 overflow-auto bg-zinc-50 p-8">
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Settings</h1>
          <p className="text-sm text-zinc-400 mt-1">Configure FireForm to match your workflow.</p>
        </div>

        <SectionHeader icon={Cpu} title="AI Model" />
        <div className="bg-white border border-zinc-200 rounded-xl px-5">
          <SettingRow
            label="LLM provider and model"
            description="Choose from the providers and models enabled by your FireForm server."
          >
            <ModelSelector />
          </SettingRow>
        </div>

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
