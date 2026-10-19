import { useEffect, useState } from 'react'
import {
  Layers,
  FileText,
  History,
  Flame,
  Settings2,
} from 'lucide-react'
import { useStore, selectHasUnsavedWork } from './store'
import { waitForBackend, fetchTemplates, fetchBackendStatus } from './lib/api'
import type { BackendStatus } from './lib/api'
import { Studio } from './features/studio/Studio'
import { TemplatesList } from './features/templates-list/TemplatesList'
import { LoadingScreen } from './components/LoadingScreen'
import { Submissions } from './features/submissions/Submissions'
import { PdfPreviewer } from './components/PdfPreviewer'
import { Settings } from './features/settings/Settings'
import { cn } from './lib/utils'

const NAV_ITEMS = [
  { id: 'studio', label: 'Studio & Workspace', icon: Layers },
  { id: 'templatesList', label: 'Templates Library', icon: FileText },
  { id: 'submissions', label: 'Submissions & Analytics', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

export function App() {
  const { activeTab, setActiveTab, setTemplates, templates } = useStore(s => ({
    activeTab: s.activeTab,
    setActiveTab: s.setActiveTab,
    setTemplates: s.setTemplates,
    templates: s.templates,
  }))

  const [ready, setReady] = useState(false)
  const [backend, setBackend] = useState<{ status: BackendStatus; detail: string }>({
    status: 'connected',
    detail: '',
  })

  useEffect(() => {
    waitForBackend().then(async () => {
      // Load live templates before rendering so stale localStorage data never shows first
      try {
        const fetched = await fetchTemplates()
        setTemplates(fetched)
      } catch {
        // Fallback handled by store
      }
      // Open Studio on the first template by default; null is reserved for "New Template"
      const { templates: loaded, activeTemplateId, setActiveTemplateId } = useStore.getState()
      if (activeTemplateId === null && loaded[0]) setActiveTemplateId(loaded[0].id)
      setReady(true)
    })
  }, [])

  // Warn before a reload / window close drops unsaved Studio work. Electron cancels the unload
  // silently, so src/main shows the Leave/Stay dialog on 'will-prevent-unload'.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!selectHasUnsavedWork(useStore.getState())) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // Poll backend health so the header pill reflects reality.
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      const next = await fetchBackendStatus()
      if (cancelled) return
      setBackend(next)
      timer = setTimeout(poll, 15000)
    }
    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [ready])

  if (!ready) return <LoadingScreen />

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-50 text-zinc-950 font-sans overflow-hidden select-none">
      {/* Top Application Header Bar */}
      <header className="h-12 border-b border-zinc-200 bg-white px-4 flex items-center justify-between flex-shrink-0">
        {/* Left: App Title and Logo */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <span className="text-sm font-bold tracking-tight text-zinc-900">FireForm</span>
          <span className="text-[11px] font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-100">
            v1.1.0
          </span>
        </div>

        {/* Center: Top Navigation Links (Photo 2 Pill Style) */}
        <nav className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200 text-xs">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const isActive = activeTab === item.id || (item.id === 'studio' && activeTab === 'fillForm')
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 select-none',
                  isActive
                    ? 'bg-white text-zinc-950 font-semibold shadow-xs border border-zinc-200/80'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-zinc-950' : 'text-zinc-500')} />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Right: Live Connection Status Pill (Photo 2 style: ● Saved · v1) */}
        <div className="flex items-center gap-3">
          <div
            title={backend.detail}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium',
              backend.status === 'connected' && 'bg-emerald-50 border-emerald-200 text-emerald-800',
              backend.status === 'degraded' && 'bg-amber-50 border-amber-200 text-amber-800',
              backend.status === 'disconnected' && 'bg-red-50 border-red-200 text-red-700'
            )}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                backend.status === 'connected' && 'bg-emerald-500 animate-pulse',
                backend.status === 'degraded' && 'bg-amber-500',
                backend.status === 'disconnected' && 'bg-red-500'
              )}
            />
            <span>
              {backend.status === 'connected' ? 'Connected' : backend.status === 'degraded' ? 'Degraded' : 'Disconnected'}
            </span>
          </div>

          <div className="text-[11px] font-mono text-zinc-400">
            <span>{templates.length} {templates.length === 1 ? 'template' : 'templates'}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {(activeTab === 'studio' || activeTab === 'fillForm' || activeTab === 'createTemplate') && (
          <Studio />
        )}
        {activeTab === 'templatesList' && (
          <div className="flex-1 overflow-auto p-6 bg-zinc-50">
            <div className="max-w-6xl mx-auto">
              <TemplatesList />
            </div>
          </div>
        )}
        {activeTab === 'submissions' && (
          <div className="flex-1 overflow-auto p-6 bg-zinc-50">
            <div className="max-w-6xl mx-auto">
              <Submissions />
            </div>
          </div>
        )}
        {activeTab === 'pdfPreviewer' && <PdfPreviewer />}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  )
}
