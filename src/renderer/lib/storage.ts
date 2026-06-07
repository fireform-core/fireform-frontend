import { Template } from '../types'

const TEMPLATES_KEY = 'fireform.templates.v1'
const LAST_OUTPUT_KEY = 'fireform.lastOutputPath.v1'

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
