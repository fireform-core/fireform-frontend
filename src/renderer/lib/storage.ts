import { Template } from '../types'

const TEMPLATES_KEY = 'fireform.templates.v1'
const LAST_OUTPUT_KEY = 'fireform.lastOutputPath.v1'
const TEMPLATES_VIEW_KEY = 'fireform.templatesView.v1'

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
