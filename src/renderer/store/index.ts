import { create } from 'zustand'
import type { FieldRow, Template } from '../types'
import { fetchLLMModels, pullModel, type LLMModelChoice, type ModelProgress } from '../lib/api'
import {
  loadTemplates,
  saveTemplates,
  loadLastOutputPath,
  loadSelectedLLM,
  saveSelectedLLM,
} from '../lib/storage'

export interface ModelDownloadState {
  provider: string
  model: string
  previousSelection: LLMModelChoice | null
  status: 'downloading' | 'success' | 'error'
  progress: ModelProgress | null
  error: string
}

export interface AppNotification {
  text: string
  type: 'success' | 'error'
}

// Unsaved Studio Builder draft. Memory only (never localStorage) so it survives tab switches.
export interface StudioDraft {
  mode: 'builder' | 'filler'
  templateName: string
  templateDescription: string
  fieldRows: FieldRow[]
  selectedFile: File | null
  uploadedPdfPath: string | null
  // Template the draft was seeded from; Studio only re-seeds when the active id differs
  seededTemplateId: number | null
  // Rows edited by the user (only then are `fields` sent; Studio's flat dict is lossy)
  fieldsEdited: boolean
  // PDF uploaded / made fillable since seeding; PUT can't replace a template's PDF
  pdfChanged: boolean
  descriptionEdited: boolean
}

const EMPTY_STUDIO_DRAFT: StudioDraft = {
  mode: 'filler',
  templateName: '',
  templateDescription: '',
  fieldRows: [{ name: '', type: 'string' }],
  selectedFile: null,
  uploadedPdfPath: null,
  seededTemplateId: null,
  fieldsEdited: false,
  pdfChanged: false,
  descriptionEdited: false,
}

interface AppStore {
  templates: Template[]
  selectedFillIds: number[]
  activeTab: string
  previewPath: string
  activeTemplateId: number | null
  selectedFieldKey: string | null
  narrativeText: string
  // Narrative edited since the last successful fill
  narrativeDirty: boolean
  studioDraft: StudioDraft
  selectedLLM: LLMModelChoice | null
  modelDownload: ModelDownloadState | null
  notification: AppNotification | null

  setTemplates: (templates: Template[]) => void
  upsertTemplate: (template: Template) => void
  removeTemplate: (id: number) => void
  toggleFillSelection: (id: number) => void
  addFillSelection: (id: number) => void
  setActiveTab: (tab: string) => void
  setPreviewPath: (path: string) => void
  setActiveTemplateId: (id: number | null) => void
  setSelectedFieldKey: (key: string | null) => void
  setNarrativeText: (text: string | ((prev: string) => string)) => void
  markNarrativeFilled: () => void
  setStudioDraft: (patch: Partial<StudioDraft>) => void
  setStudioFieldRows: (rows: FieldRow[] | ((prev: FieldRow[]) => FieldRow[])) => void
  resetStudioDraft: () => void
  setSelectedLLM: (selection: LLMModelChoice | null) => void
  startModelDownload: (provider: string, model: string) => Promise<void>
  clearNotification: () => void
}

// Unsaved changes compared with the saved template (or anything entered for a new one)
export function selectStudioDraftDirty(state: AppStore): boolean {
  const draft = state.studioDraft
  if (draft.fieldsEdited || draft.pdfChanged || draft.descriptionEdited) return true
  const saved = state.templates.find(t => t.id === draft.seededTemplateId)
  return draft.templateName.trim() !== (saved?.name ?? '').trim()
}

// Work that a reload, window close or quit would lose (see beforeunload in App)
export function selectHasUnsavedWork(state: AppStore): boolean {
  return selectStudioDraftDirty(state) || (state.narrativeDirty && state.narrativeText.trim() !== '')
}

export const useStore = create<AppStore>((set, get) => ({
  templates: loadTemplates(),
  selectedFillIds: [],
  activeTab: 'studio',
  previewPath: loadLastOutputPath() || '',
  activeTemplateId: null,
  selectedFieldKey: null,
  // Studio narrative: kept in memory only (may contain incident PII), survives tab switches
  narrativeText: '',
  narrativeDirty: false,
  studioDraft: EMPTY_STUDIO_DRAFT,
  selectedLLM: loadSelectedLLM(),
  modelDownload: null,
  notification: null,

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
      description: template.description || '',
      pdf_path: template.pdf_path || '',
      fields: template.fields || {},
      field_count: template.field_count,
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
    // Deleting the template Studio is editing also drops its draft (the delete was confirmed)
    if (get().activeTemplateId === id || get().studioDraft.seededTemplateId === id) {
      get().resetStudioDraft()
      set({ activeTemplateId: null })
    }
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
  setActiveTemplateId: (activeTemplateId) => set({ activeTemplateId }),
  setSelectedFieldKey: (selectedFieldKey) => set({ selectedFieldKey }),
  setNarrativeText: (text) =>
    set(state => ({
      narrativeText: typeof text === 'function' ? text(state.narrativeText) : text,
      narrativeDirty: true,
    })),
  markNarrativeFilled: () => set({ narrativeDirty: false }),
  setStudioDraft: (patch) => set(state => ({ studioDraft: { ...state.studioDraft, ...patch } })),
  setStudioFieldRows: (rows) =>
    set(state => ({
      studioDraft: {
        ...state.studioDraft,
        fieldRows: typeof rows === 'function' ? rows(state.studioDraft.fieldRows) : rows,
      },
    })),
  // Discard the draft; keeps the Builder/Filler mode the user is in
  resetStudioDraft: () => set(state => ({ studioDraft: { ...EMPTY_STUDIO_DRAFT, mode: state.studioDraft.mode } })),
  setSelectedLLM: (selectedLLM) => {
    saveSelectedLLM(selectedLLM)
    set({ selectedLLM })
  },
  startModelDownload: async (provider, model) => {
    if (get().modelDownload?.status === 'downloading') return

    const previousSelection = get().selectedLLM
    set({
      modelDownload: {
        provider,
        model,
        previousSelection,
        status: 'downloading',
        progress: null,
        error: '',
      },
    })

    try {
      await pullModel(model, progress => {
        set(state => ({
          modelDownload: state.modelDownload
            ? { ...state.modelDownload, progress }
            : state.modelDownload,
        }))
      })
      const refreshed = await fetchLLMModels(true)
      const installed = refreshed.providers
        .find(item => item.provider === provider)
        ?.models.some(item => item.name === model && item.installed === true)
      if (!installed) throw new Error(`${model} completed downloading but is not listed as installed.`)

      saveSelectedLLM({ provider, model })
      set({
        selectedLLM: { provider, model },
        modelDownload: {
          provider,
          model,
          previousSelection,
          status: 'success',
          progress: { status: 'success' },
          error: '',
        },
        notification: { text: `${model} installed`, type: 'success' },
      })
      setTimeout(() => set({ notification: null }), 5000)
      setTimeout(() => set(state => (
        state.modelDownload?.model === model && state.modelDownload.status === 'success'
          ? { modelDownload: null }
          : state
      )), 5000)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Model download failed.'
      set({
        modelDownload: {
          provider,
          model,
          previousSelection,
          status: 'error',
          progress: null,
          error: message,
        },
        notification: { text: message, type: 'error' },
      })
      setTimeout(() => set({ notification: null }), 7000)
      setTimeout(() => set(state => (
        state.modelDownload?.model === model && state.modelDownload.status === 'error'
          ? { modelDownload: null }
          : state
      )), 7000)
    }
  },
  clearNotification: () => set({ notification: null }),
}))
