import { useState, useMemo } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Sparkles,
  Upload,
  Mic,
  MicOff,
  Loader2,
  CloudRain,
  MapPin,
  FileCheck,
  Layers,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { cn } from '../../lib/utils'
import type { FieldRow } from '../../types'
import { FIELD_TYPES, TYPE_VALUE_TO_LABEL } from '../../lib/constants'

interface StudioSidebarProps {
  mode: 'builder' | 'filler'
  onModeChange: (mode: 'builder' | 'filler') => void
  templateName: string
  onTemplateNameChange: (name: string) => void
  templateDescription: string
  onTemplateDescriptionChange: (desc: string) => void
  selectedFile: File | null
  hasPdf: boolean
  onFileSelect: (file: File) => void
  fieldRows: FieldRow[]
  onAddField: () => void
  onRemoveField: (index: number) => void
  onUpdateField: (index: number, updates: Partial<FieldRow>) => void
  selectedFieldKey: string | null
  onSelectField: (key: string) => void
  onMakeFillable: () => void
  isMakeFillableLoading: boolean
  onRegisterTemplate: () => void
  isExistingTemplate: boolean
  isRegistering: boolean
  // Filler Props
  narrativeText: string
  onNarrativeChange: (text: string) => void
  isRecording: boolean
  isTranscribing: boolean
  onToggleRecording: () => void

  onFillForm: () => void
  isFilling: boolean
  onOpenWeather: () => void
  onOpenZipcode: () => void
}

export function StudioSidebar({
  mode,
  onModeChange,
  templateName,
  onTemplateNameChange,
  templateDescription,
  onTemplateDescriptionChange,
  selectedFile,
  hasPdf,
  onFileSelect,
  fieldRows,
  onAddField,
  onRemoveField,
  onUpdateField,
  selectedFieldKey,
  onSelectField,
  onMakeFillable,
  isMakeFillableLoading,
  onRegisterTemplate,
  isExistingTemplate,
  isRegistering,
  narrativeText,
  onNarrativeChange,
  isRecording,
  isTranscribing,
  onToggleRecording,
  onFillForm,
  isFilling,
  onOpenWeather,
  onOpenZipcode,
}: StudioSidebarProps) {
  const [openSections, setOpenSections] = useState({
    template: true,
    fields: true,
    properties: true,
    narrative: true,
  })
  const [filterQuery, setFilterQuery] = useState('')

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Filtered fields based on search input (matching Photo 1 filter input)
  const filteredFields = useMemo(() => {
    if (!filterQuery.trim()) return fieldRows
    const q = filterQuery.toLowerCase()
    return fieldRows.filter(
      f => f.name.toLowerCase().includes(q) || f.type.toLowerCase().includes(q)
    )
  }, [fieldRows, filterQuery])

  // Active selected field for the Field Properties inspector
  const selectedFieldIndex = fieldRows.findIndex(
    f => f.name === selectedFieldKey
  )
  const selectedField = selectedFieldIndex >= 0 ? fieldRows[selectedFieldIndex] : null

  return (
    <aside className="w-96 flex flex-col h-full min-h-0 bg-white border-l border-zinc-200 select-none overflow-hidden font-sans">
      {/* Top Sidebar Header (Mode Selector - Builder vs Filler) */}
      <div className="h-11 border-b border-zinc-200 px-3 flex items-center justify-between bg-zinc-50/70">
        <div className="flex items-center gap-1 bg-zinc-200/70 p-0.5 rounded-md text-xs w-full">
          <button
            type="button"
            onClick={() => onModeChange('builder')}
            className={cn(
              'flex-1 py-1 rounded text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
              mode === 'builder'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            Template Builder
          </button>
          <button
            type="button"
            onClick={() => onModeChange('filler')}
            className={cn(
              'flex-1 py-1 rounded text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
              mode === 'filler'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Form Filler
          </button>
        </div>
      </div>

      {/* Scrollable Configuration Sections */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-zinc-100">
        {/* Section 1: Template Metadata (Photo 1 matching) */}
        {mode === 'builder' && (
        <div className="p-3.5">
          <div
            onClick={() => toggleSection('template')}
            className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-600 cursor-pointer hover:text-zinc-900 mb-2"
          >
            <div className="flex items-center gap-1.5">
              {openSections.template ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
              <span>Template</span>
            </div>
            <span className="text-[11px] font-mono lowercase text-zinc-400 font-normal">
              {templateName}
            </span>
          </div>

          {openSections.template && (
            <div className="space-y-2.5 mt-2">
              <div>
                <Input
                  value={templateName}
                  onChange={e => onTemplateNameChange(e.target.value)}
                  placeholder="Template name (e.g. Incident Report)"
                  className="font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-zinc-500 font-semibold block mb-1">
                  Description of the template
                </label>
                <textarea
                  rows={3}
                  value={templateDescription}
                  onChange={e => onTemplateDescriptionChange(e.target.value)}
                  placeholder="Describe the purpose and context of this form (e.g. Standard NFIRS emergency incident report for structure fires) to give the LLM context..."
                  className="w-full text-xs rounded-md border border-zinc-200 bg-white p-2.5 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none font-sans"
                />
              </div>

              {/* PDF File Upload Trigger / Dropzone */}
              <div className="border border-dashed border-zinc-200 hover:border-zinc-400 rounded-md p-2.5 text-center bg-zinc-50/50 hover:bg-zinc-50 transition-colors">
                <label className="cursor-pointer block">
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={e => {
                      if (e.target.files?.[0]) onFileSelect(e.target.files[0])
                    }}
                  />
                  <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-700 font-medium">
                    <Upload className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{selectedFile ? selectedFile.name : 'Upload or replace PDF template'}</span>
                  </div>
                </label>
              </div>

              <div className="text-[10px] text-zinc-400 font-mono flex items-center justify-between">
                <span>{templateName && `form_type: ${templateName.toLowerCase().replace(/\s+/g, '_')}`}</span>
                <span>{hasPdf ? 'PDF Ready' : 'No PDF yet'}</span>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Mode Specific Section: Filler Narrative Input */}
        {mode === 'filler' && (
          <div className="p-3.5 bg-zinc-50/50">
            <div
              onClick={() => toggleSection('narrative')}
              className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-600 cursor-pointer hover:text-zinc-900 mb-2"
            >
              <div className="flex items-center gap-1.5">
                {openSections.narrative ? (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                )}
                <span>Incident Narrative</span>
              </div>
              <Badge variant="amber" className="text-[10px] py-0 px-1.5">
                AI Input
              </Badge>
            </div>

            {openSections.narrative && (
              <div className="space-y-2.5 mt-2">
                <div className="relative">
                  <textarea
                    rows={4}
                    value={narrativeText}
                    onChange={e => onNarrativeChange(e.target.value)}
                    placeholder="Enter dispatch notes, officer transcript, or incident narrative..."
                    className="w-full text-xs rounded-md border border-zinc-200 bg-white p-2.5 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none"
                  />
                  <button
                    type="button"
                    onClick={onToggleRecording}
                    disabled={isTranscribing}
                    className={cn(
                      'absolute right-2 bottom-2 p-1.5 rounded-full transition-colors disabled:opacity-60',
                      isRecording
                        ? 'bg-red-600 text-white animate-pulse'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    )}
                    title={
                      isTranscribing
                        ? 'Transcribing…'
                        : isRecording
                          ? 'Stop speech recording'
                          : 'Record voice transcript with Whisper'
                    }
                  >
                    {isTranscribing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isRecording ? (
                      <MicOff className="w-3.5 h-3.5" />
                    ) : (
                      <Mic className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Assistant Tools */}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={onOpenWeather}
                    className="text-[11px] flex-1 bg-white text-zinc-700"
                  >
                    <CloudRain className="w-3 h-3 mr-1 text-blue-600" />
                    Weather
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={onOpenZipcode}
                    className="text-[11px] flex-1 bg-white text-zinc-700"
                  >
                    <MapPin className="w-3 h-3 mr-1 text-emerald-600" />
                    Address
                  </Button>

                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 2: Fields List (Photo 1 Matching) */}
        {/* Fields and Field Properties are template-building tools: Builder mode only */}
        {mode === 'builder' && (<>
        <div className="p-3.5">
          <div
            onClick={() => toggleSection('fields')}
            className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-600 cursor-pointer hover:text-zinc-900 mb-2"
          >
            <div className="flex items-center gap-1.5">
              {openSections.fields ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
              <span>Fields</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-500 font-semibold">
              {fieldRows.length}
            </span>
          </div>

          {openSections.fields && (
            <div className="space-y-2 mt-2">
              {/* Search Filter Input (matching Photo 1 'Filter fields...') */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
                <Input
                  value={filterQuery}
                  onChange={e => setFilterQuery(e.target.value)}
                  placeholder="Filter fields..."
                  className="pl-8 text-xs h-8"
                />
              </div>

              {/* Scrollable Fields List Items */}
              <div className="max-h-64 overflow-y-auto space-y-1 pr-0.5 divide-y divide-zinc-50 border border-zinc-100 rounded-md p-1 bg-zinc-50/40">
                {filteredFields.map((field, idx) => {
                  const isSelected = selectedFieldKey === field.name
                  return (
                    <div
                      key={idx}
                      onClick={() => onSelectField(field.name)}
                      className={cn(
                        'flex items-center justify-between p-1.5 rounded text-xs cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-zinc-900 text-white font-medium'
                          : 'hover:bg-zinc-100 text-zinc-800'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            'font-mono text-[10px] w-5',
                            isSelected ? 'text-zinc-300 font-bold' : 'text-zinc-400'
                          )}
                        >
                          #{idx + 1}
                        </span>
                        <div className="truncate">
                          <p className="truncate text-xs">{field.name || 'Unnamed Field'}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span
                              className={cn(
                                'text-[9px] uppercase font-mono font-semibold px-1 rounded',
                                isSelected
                                  ? 'bg-blue-900/60 text-blue-200'
                                  : 'bg-blue-50 text-blue-700'
                              )}
                            >
                              {TYPE_VALUE_TO_LABEL[field.type] || field.type}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          onRemoveField(idx)
                        }}
                        className={cn(
                          'p-1 rounded hover:opacity-100 opacity-60 text-xs transition-opacity',
                          isSelected ? 'text-zinc-300 hover:text-white' : 'text-zinc-400 hover:text-red-600'
                        )}
                        title="Delete field"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Action Buttons: Add Field & Extract Schema */}
              <div className="flex items-center gap-1.5 pt-1">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={onAddField}
                  className="flex-1 bg-white text-zinc-800 border-zinc-200 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Field
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={onMakeFillable}
                  disabled={isMakeFillableLoading}
                  className="flex-1 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white border-zinc-900 text-xs"
                >
                  <Sparkles className="w-3 h-3 mr-1 text-amber-300" />
                  {isMakeFillableLoading ? 'Extracting...' : 'AI Schema'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Field Properties Inspector */}
        <div className="p-3.5">
          <div
            onClick={() => toggleSection('properties')}
            className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-600 cursor-pointer hover:text-zinc-900 mb-2"
          >
            <div className="flex items-center gap-1.5">
              {openSections.properties ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
              <span>Field Properties</span>
            </div>
          </div>

          {openSections.properties && (
            <div className="space-y-2 mt-2">
              {selectedField ? (
                <div className="space-y-2 bg-zinc-50 p-2.5 rounded-md border border-zinc-200">
                  <div>
                    <label className="text-[10px] uppercase font-mono text-zinc-500 font-semibold block mb-1">
                      Field Label
                    </label>
                    <Input
                      value={selectedField.name}
                      onChange={e =>
                        onUpdateField(selectedFieldIndex, { name: e.target.value })
                      }
                      className="text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-mono text-zinc-500 font-semibold block mb-1">
                      Data Type
                    </label>
                    <select
                      value={selectedField.type}
                      onChange={e =>
                        onUpdateField(selectedFieldIndex, { type: e.target.value })
                      }
                      className="w-full text-xs h-8 rounded-md border border-zinc-200 bg-white px-2 font-medium text-zinc-800"
                    >
                      {FIELD_TYPES.map(t => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-400 italic py-2 text-center">
                  Select a field on the PDF or in the list to edit its properties.
                </p>
              )}
            </div>
          )}
        </div>
        </>)}
      </div>

      {/* Action Footer (Prominent Full Width Button matching Photo 1) */}
      <div className="p-3 border-t border-zinc-200 bg-white flex-shrink-0">
        {mode === 'builder' ? (
          <Button
            onClick={onRegisterTemplate}
            disabled={isRegistering || !templateName.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-10 text-sm shadow-sm rounded-md"
          >
            <FileCheck className="w-4 h-4 mr-2" />
            {isExistingTemplate
              ? isRegistering ? 'Saving Changes...' : 'Save Changes'
              : isRegistering ? 'Registering Template...' : 'Register Template'}
          </Button>
        ) : (
          <Button
            onClick={onFillForm}
            disabled={isFilling || (!narrativeText.trim() && !selectedFieldKey)}
            className="w-full bg-zinc-950 hover:bg-zinc-800 text-white font-semibold h-10 text-sm shadow-sm rounded-md"
          >
            <Sparkles className="w-4 h-4 mr-2 text-amber-300" />
            {isFilling ? 'Filling Document...' : 'Auto-Fill & Generate PDF'}
          </Button>
        )}
      </div>
    </aside>
  )
}
