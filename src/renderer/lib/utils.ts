import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { FIELD_TYPES } from './constants'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Chromium's built-in PDF viewer opens with the thumbnail side panel; #navpanes=0 starts it
// collapsed (the viewer's menu button still opens it). URLs that already carry a fragment are left alone.
export function withPdfViewerParams(url: string): string {
  return url && !url.includes('#') ? `${url}#navpanes=0` : url
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

export function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function normalizeFieldType(value: string): string {
  return FIELD_TYPES.some(t => t.value === value) ? value : 'string'
}
