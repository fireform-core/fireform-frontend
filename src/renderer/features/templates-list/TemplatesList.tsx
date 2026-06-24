import { useState } from 'react'
import { useStore } from '../../store'
import { TYPE_VALUE_TO_LABEL } from '../../lib/constants'
import { pluralize } from '../../lib/utils'
import { loadTemplatesView, saveTemplatesView, TemplatesView } from '../../lib/storage'

export function TemplatesList() {
  const { templates, addFillSelection, setActiveTab, setPreviewPath } = useStore(s => ({
    templates: s.templates,
    addFillSelection: s.addFillSelection,
    setActiveTab: s.setActiveTab,
    setPreviewPath: s.setPreviewPath,
  }))

  const [view, setView] = useState<TemplatesView>(loadTemplatesView)

  function changeView(next: TemplatesView) {
    setView(next)
    saveTemplatesView(next)
  }

  function handlePreview(pdfPath: string) {
    setPreviewPath(pdfPath)
    setActiveTab('pdfPreviewer')
  }

  function handleUseFill(templateId: number) {
    addFillSelection(templateId)
    setActiveTab('fillForm')
    // The FillForm will show the template as selected on next render.
  }

  return (
    <section className="panel card">
      <div className="panel-header">
        <h2>Templates</h2>
        <div className="view-toggle" role="group" aria-label="Templates view">
          <button
            type="button"
            className={`view-toggle-btn${view === 'list' ? ' active' : ''}`}
            aria-pressed={view === 'list'}
            onClick={() => changeView('list')}
          >
            List
          </button>
          <button
            type="button"
            className={`view-toggle-btn${view === 'grid' ? ' active' : ''}`}
            aria-pressed={view === 'grid'}
            onClick={() => changeView('grid')}
          >
            Grid
          </button>
        </div>
      </div>
      <p className="helper">
        Templates are loaded from the database and refreshed automatically. Click a template to
        preview its PDF.
      </p>

      {!templates.length ? (
        <div className="empty-state">No templates stored yet.</div>
      ) : view === 'grid' ? (
        <div className="template-tiles">
          {templates.map(template => {
            const fieldCount = Object.keys(template.fields || {}).length
            return (
              <div
                key={template.id}
                className="template-tile"
                role="button"
                tabIndex={0}
                aria-label={`Preview ${template.name || 'Untitled'}`}
                onClick={() => handlePreview(template.pdf_path || '')}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handlePreview(template.pdf_path || '')
                  }
                }}
              >
                <div className="tile-body">
                  <span className="tile-title">{template.name || 'Untitled'}</span>
                  <span className="tile-meta">
                    id: {template.id ?? 'n/a'} · {pluralize(fieldCount, 'field')}
                  </span>
                </div>
                <button
                  type="button"
                  className="tile-preview-btn"
                  onClick={e => {
                    e.stopPropagation()
                    handleUseFill(template.id)
                  }}
                >
                  Use in Fill Form
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="template-list">
          {templates.map(template => {
            const entries = Object.entries(template.fields || {})
            return (
              <article
                key={template.id}
                className="template-card is-clickable"
                role="button"
                tabIndex={0}
                aria-label={`Preview ${template.name || 'Untitled'}`}
                onClick={() => handlePreview(template.pdf_path || '')}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handlePreview(template.pdf_path || '')
                  }
                }}
              >
                <h3>
                  {template.name || 'Untitled'} (id: {template.id ?? 'n/a'})
                </h3>
                <p className="template-meta">pdf_path: {template.pdf_path || ''}</p>

                <table className="fields-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 ? (
                      <tr>
                        <td colSpan={2}>No fields.</td>
                      </tr>
                    ) : (
                      entries.map(([name, type]) => (
                        <tr key={name}>
                          <td>{name}</td>
                          <td>{TYPE_VALUE_TO_LABEL[type] || 'Text'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <div className="card-actions">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      handleUseFill(template.id)
                    }}
                  >
                    Use in Fill Form
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
