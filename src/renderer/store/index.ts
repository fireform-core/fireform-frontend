import { create } from 'zustand'
import { Template } from '../types'
import { loadTemplates, saveTemplates, loadLastOutputPath } from '../lib/storage'

interface AppStore {
  templates: Template[]
  selectedFillIds: number[]
  activeTab: string
  previewPath: string

  setTemplates: (templates: Template[]) => void
  upsertTemplate: (template: Template) => void
  removeTemplate: (id: number) => void
  toggleFillSelection: (id: number) => void
  addFillSelection: (id: number) => void
  setActiveTab: (tab: string) => void
  setPreviewPath: (path: string) => void
}

export const useStore = create<AppStore>((set, get) => ({
  templates: loadTemplates(),
  selectedFillIds: [],
  activeTab: 'fillForm',
  previewPath: loadLastOutputPath() || '',

  setTemplates: (templates) => {
    saveTemplates(templates)
    const liveIds = new Set(templates.map(t => t.id))
    const selectedFillIds = get().selectedFillIds.filter(id => liveIds.has(id))
    set({ templates, selectedFillIds })
  },

  upsertTemplate: (template) => {
    const normalized: Template = {
      id: template.id,
      name: template.name || '',
      pdf_path: template.pdf_path || '',
      fields: template.fields || {},
    }
    const templates = get().templates
    const index = templates.findIndex(t => t.id === normalized.id)
    const updated =
      index >= 0
        ? templates.map((t, i) => (i === index ? normalized : t))
        : [normalized, ...templates]
    saveTemplates(updated)
    set({ templates: updated })
  },

  removeTemplate: (id) => {
    const templates = get().templates.filter(t => t.id !== id)
    const selectedFillIds = get().selectedFillIds.filter(i => i !== id)
    saveTemplates(templates)
    set({ templates, selectedFillIds })
  },

  toggleFillSelection: (id) => {
    const current = get().selectedFillIds
    set({
      selectedFillIds: current.includes(id)
        ? current.filter(i => i !== id)
        : [...current, id],
    })
  },

  addFillSelection: (id) => {
    const current = get().selectedFillIds
    if (!current.includes(id)) set({ selectedFillIds: [...current, id] })
  },

  setActiveTab: (activeTab) => set({ activeTab }),
  setPreviewPath: (previewPath) => set({ previewPath }),
}))
