import type { Template } from '../types'
import type { LLMModelChoice } from './api'

const TEMPLATES_KEY = 'fireform.templates.v1'
const LAST_OUTPUT_KEY = 'fireform.lastOutputPath.v1'
const TEMPLATES_VIEW_KEY = 'fireform.templatesView.v1'
const SELECTED_LLM_KEY = 'fireform.selectedLLM.v1'

export type TemplatesView = 'list' | 'grid'

export function loadTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveTemplates(templates: Template[]): void {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
}

export function loadLastOutputPath(): string | null {
  return localStorage.getItem(LAST_OUTPUT_KEY)
}

export function saveLastOutputPath(path: string): void {
  localStorage.setItem(LAST_OUTPUT_KEY, path)
}

export function loadTemplatesView(): TemplatesView {
  return localStorage.getItem(TEMPLATES_VIEW_KEY) === 'grid' ? 'grid' : 'list'
}

export function saveTemplatesView(view: TemplatesView): void {
  localStorage.setItem(TEMPLATES_VIEW_KEY, view)
}

export function loadSelectedLLM(): LLMModelChoice | null {
  try {
    const raw = localStorage.getItem(SELECTED_LLM_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as Record<string, unknown>)['provider'] !== 'string' ||
      typeof (parsed as Record<string, unknown>)['model'] !== 'string'
    ) return null
    return parsed as LLMModelChoice
  } catch {
    return null
  }
}

export function saveSelectedLLM(selection: LLMModelChoice | null): void {
  try {
    if (selection) localStorage.setItem(SELECTED_LLM_KEY, JSON.stringify(selection))
    else localStorage.removeItem(SELECTED_LLM_KEY)
  } catch {
    // Storage may be unavailable in restricted renderer contexts.
  }
}
