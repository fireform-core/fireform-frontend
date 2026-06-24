import { useEffect, useState } from 'react'
import { useStore } from './store'
import { waitForBackend, fetchTemplates } from './lib/api'
import { TemplateBuilder } from './features/template-builder/TemplateBuilder'
import { FillForm } from './features/fill-form/FillForm'
import { TemplatesList } from './features/templates-list/TemplatesList'
import { PdfPreviewer } from './components/PdfPreviewer'
import { LoadingScreen } from './components/LoadingScreen'

const TABS = [
  { id: 'fillForm', label: 'Fill Form' },
  { id: 'createTemplate', label: 'Create Template' },
  { id: 'templatesList', label: 'Templates' },
  { id: 'pdfPreviewer', label: 'PDF Preview' },
]

export function App() {
  const { activeTab, setActiveTab, setTemplates } = useStore(s => ({
    activeTab: s.activeTab,
    setActiveTab: s.setActiveTab,
    setTemplates: s.setTemplates,
  }))

  const [ready, setReady] = useState(false)

  useEffect(() => {
    waitForBackend().then(async () => {
      setReady(true)
      try {
        const templates = await fetchTemplates()
        setTemplates(templates)
      } catch {
        // store keeps localStorage templates as fallback
      }
    })
  }, [])

  if (!ready) return <LoadingScreen />

  return (
    <div className="app-shell">
      <header className="app-header">
        <p className="eyebrow">Desktop App</p>
        <h1>FireForm</h1>
        <p className="subtitle">Report once, file everywhere.</p>
      </header>

      <nav className="tabs" aria-label="Primary sections">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main>
        {activeTab === 'createTemplate' && <TemplateBuilder />}
        {activeTab === 'fillForm' && <FillForm />}
        {activeTab === 'templatesList' && <TemplatesList />}
        {activeTab === 'pdfPreviewer' && <PdfPreviewer />}
      </main>
    </div>
  )
}
