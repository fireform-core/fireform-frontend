import { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  Search,
  LayoutGrid,
  List as ListIcon,
  Eye,
  Layers,
  Trash2,
  Plus,
  Info,
} from 'lucide-react'
import { useStore } from '../../store'
import { TYPE_VALUE_TO_LABEL } from '../../lib/constants'
import { pluralize, cn } from '../../lib/utils'
import type { TemplatesView } from '../../lib/storage'
import { loadTemplatesView, saveTemplatesView } from '../../lib/storage'
import { useDeleteTemplate } from '../../lib/useDeleteTemplate'
import { useStudioDiscardGuard } from '../../lib/useStudioDiscardGuard'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card'

function getFieldEntries(fields: Record<string, any> = {}): Array<{ name: string; type: string }> {
  if (fields.schema && typeof fields.schema === 'object') {
    const props = (fields.schema as Record<string, any>).properties || {}
    const entries: Array<{ name: string; type: string }> = []
    for (const [key, prop] of Object.entries(props)) {
      if (prop && typeof prop === 'object') {
        const p = prop as { type?: string; description?: string; items?: { properties?: Record<string, { description?: string; type?: string }> } }
        if (p.type === 'array' && p.items?.properties) {
          for (const [colKey, colProp] of Object.entries(p.items.properties)) {
            entries.push({
              name: colProp.description || `${key}.${colKey}`,
              type: 'Table Column',
            })
          }
        } else {
          entries.push({
            name: p.description || key,
            type: p.type === 'enum' ? 'Choice' : p.type || 'Text',
          })
        }
      }
    }
    return entries
  }
  return Object.entries(fields).map(([name, type]) => ({
    name,
    type: typeof type === 'string' ? (TYPE_VALUE_TO_LABEL[type] || type) : 'Text',
  }))
}

export function TemplatesList() {
  const { templates, setActiveTab, setPreviewPath } = useStore(s => ({
    templates: s.templates,
    setActiveTab: s.setActiveTab,
    setPreviewPath: s.setPreviewPath,
  }))

  const [view, setView] = useState<TemplatesView>(loadTemplatesView)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDescription, setSelectedDescription] = useState<{
    name: string
    description: string
  } | null>(null)

  useEffect(() => {
    if (!selectedDescription) return

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedDescription(null)
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selectedDescription])
  const del = useDeleteTemplate()

  function changeView(next: TemplatesView) {
    setView(next)
    saveTemplatesView(next)
  }

  // Asks before replacing an unsaved Studio draft
  const studioGuard = useStudioDiscardGuard()

  function handleOpenInStudio(templateId: number) {
    studioGuard.open(templateId)
  }

  function handlePreview(pdfPath: string) {
    setPreviewPath(pdfPath)
    setActiveTab('pdfPreviewer')
  }
  function handleViewDescription(name: string, description: string) {
    setSelectedDescription({ name, description })
  }

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates
    const q = searchQuery.toLowerCase()
    return templates.filter(
      t =>
        t.name.toLowerCase().includes(q) ||
        (t.pdf_path && t.pdf_path.toLowerCase().includes(q))
    )
  }, [templates, searchQuery])

  return (
    <div className="space-y-6">
      {/* Top Header & Search Bar (Photo 2 white & black aesthetic) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Templates Library</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Registered incident forms and government reporting templates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="pl-8 text-xs bg-white"
            />
          </div>

          <div className="flex items-center bg-zinc-100 p-0.5 rounded-md border border-zinc-200">
            <button
              type="button"
              onClick={() => changeView('grid')}
              className={cn(
                'p-1.5 rounded transition-colors',
                view === 'grid' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'
              )}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => changeView('list')}
              className={cn(
                'p-1.5 rounded transition-colors',
                view === 'list' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'
              )}
              title="List View"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button
            onClick={() => studioGuard.open(null)}
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs h-8"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Template
          </Button>
        </div>
      </div>

      {/* Content View (Grid or Table) */}
      {filteredTemplates.length === 0 ? (
        <div className="p-12 text-center bg-white border border-dashed border-zinc-200 rounded-lg">
          <FileText className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-zinc-800">No templates found</p>
          <p className="text-xs text-zinc-500 mt-1">
            Create your first template in the Studio workspace.
          </p>
          <Button
            onClick={() => setActiveTab('studio')}
            variant="outline"
            size="sm"
            className="mt-4"
          >
            Open Studio
          </Button>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(tpl => {
            const fieldEntries = getFieldEntries(tpl.fields)
            const count = tpl.field_count ?? fieldEntries.length

            return (
              <Card
                key={tpl.id}
                className="hover:border-zinc-400 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-zinc-100 flex items-center justify-center text-zinc-700">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold text-zinc-900">
                          {tpl.name}
                        </CardTitle>
                        <p className="text-[10px] font-mono text-zinc-400 truncate max-w-[180px]">
                          {tpl.pdf_path}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {pluralize(count, 'field')}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-2">
                  <div className="flex flex-wrap gap-1 mb-4">
                    {fieldEntries.slice(0, 4).map((f, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded font-medium truncate max-w-[120px]"
                      >
                        {f.name}
                      </span>
                    ))}
                    {fieldEntries.length > 4 && (
                      <span className="text-[10px] text-zinc-400 px-1 py-0.5">
                        +{fieldEntries.length - 4} more
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handlePreview(tpl.pdf_path)}
                      className="text-zinc-600 hover:text-zinc-900 text-xs"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Preview
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleViewDescription(tpl.name, tpl.description)}
                      className="text-zinc-600 hover:text-zinc-900 text-xs"
                    >
                      <Info className="w-3 h-3 mr-1" />
                      Description
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="default"
                        size="xs"
                        onClick={() => handleOpenInStudio(tpl.id)}
                        className="bg-zinc-900 text-white hover:bg-zinc-800 text-xs"
                      >
                        <Layers className="w-3 h-3 mr-1" />
                        Open in Studio
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => del.request(tpl)}
                        className="text-zinc-400 hover:text-red-600 px-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* List / Table View */
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase font-mono text-[10px]">
              <tr>
                <th className="px-4 py-2.5">Template Name</th>
                <th className="px-4 py-2.5">PDF Path</th>
                <th className="px-4 py-2.5">Fields</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredTemplates.map(tpl => {
                const fieldEntries = getFieldEntries(tpl.fields)
                const count = tpl.field_count ?? fieldEntries.length

                return (
                  <tr key={tpl.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-zinc-900">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{tpl.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-500 text-[11px] truncate max-w-xs">
                      {tpl.pdf_path}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-700">
                      <Badge variant="outline" className="text-[10px]">
                        {pluralize(count, 'field')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handlePreview(tpl.pdf_path)}
                          className="text-zinc-600"
                        >
                          Preview
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handleViewDescription(tpl.name, tpl.description)}
                          className="text-zinc-600 hover:text-zinc-900 text-xs"
                        >
                          <Info className="w-3 h-3 mr-1" />
                          Description
                        </Button>
                        <Button
                          variant="default"
                          size="xs"
                          onClick={() => handleOpenInStudio(tpl.id)}
                          className="bg-zinc-900 text-white"
                        >
                          Studio
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => del.request(tpl)}
                          className="text-zinc-400 hover:text-red-600 px-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Unsaved Studio Draft Dialog */}
      <ConfirmDialog
        isOpen={Boolean(studioGuard.pending)}
        title="Unsaved Changes"
        message={`Discard unsaved changes to ${studioGuard.draftName.trim() ? `"${studioGuard.draftName.trim()}"` : 'the new template'}?`}
        confirmLabel="Discard"
        onConfirm={studioGuard.confirm}
        onCancel={studioGuard.cancel}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(del.pending)}
        title="Delete Template"
        message={`Are you sure you want to delete "${del.pending?.name}"?`}
        confirmLabel="Delete"
        busy={del.busy}
        error={del.error}
        onConfirm={del.confirm}
        onCancel={del.cancel}
      />
      {selectedDescription && (
        <div
          className="modal-overlay"
          onClick={e => {
            if (e.target === e.currentTarget) {
              setSelectedDescription(null)
            }
          }}
        >
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-description-title"
          >
            <div className="modal-body">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded bg-zinc-100 flex items-center justify-center text-zinc-700">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    id="template-description-title"
                    className="text-sm font-semibold text-zinc-900"
                  >
                    Template Description
                  </h3>
                  <p className="text-[10px] text-zinc-500">
                    {selectedDescription.name}
                  </p>
                </div>
              </div>

              <p className="text-sm leading-6 text-zinc-700 whitespace-pre-wrap">
                {selectedDescription.description || 'No description provided.'}
              </p>
            </div>

            <div className="modal-footer">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSelectedDescription(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
