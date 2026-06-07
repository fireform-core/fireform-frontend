import { useStore } from '../../store'
import { TYPE_VALUE_TO_LABEL } from '../../lib/constants'

export function TemplatesList() {
  const { templates, addFillSelection, setActiveTab, setPreviewPath } = useStore(s => ({
    templates: s.templates,
    addFillSelection: s.addFillSelection,
    setActiveTab: s.setActiveTab,
    setPreviewPath: s.setPreviewPath,
  }))

  function handlePreview(pdfPath: string) {
    setPreviewPath(pdfPath)
    setActiveTab('pdfPreviewer')
  }

  function handleUseFill(templateId: number, templateName: string) {
    addFillSelection(templateId)
    setActiveTab('fillForm')
    // The FillForm will show the template as selected on next render.
    void templateName
  }

  return (
    <section className="panel card">
      <h2>Templates</h2>
      <p className="helper">
        Templates are loaded from the database and refreshed automatically.
      </p>

      {!templates.length ? (
        <div className="empty-state">No templates stored yet.</div>
      ) : (
        <div className="template-list">
          {templates.map(template => {
            const entries = Object.entries(template.fields || {})
            return (
              <article key={template.id} className="template-card">
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
                    onClick={() => handlePreview(template.pdf_path || '')}
                  >
                    Preview This Template
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUseFill(template.id, template.name)}
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
