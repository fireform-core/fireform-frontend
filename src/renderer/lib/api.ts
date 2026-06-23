import { API_BASE_URL, DEFAULT_TEMPLATE_DIRECTORY } from './constants'
import { Template } from '../types'

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

function extractErrorMessage(body: unknown, statusCode: number): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    if (typeof b['error'] === 'string') return b['error']
    if (Array.isArray(b['detail'])) {
      const first = b['detail'][0]
      if (first && typeof first === 'object' && typeof (first as Record<string, unknown>)['msg'] === 'string') {
        return (first as Record<string, unknown>)['msg'] as string
      }
    }
    if (typeof b['detail'] === 'string') return b['detail']
    if (typeof b['raw'] === 'string') return b['raw']
  }
  return `Request failed with status ${statusCode}.`
}

export async function waitForBackend(): Promise<void> {
  while (true) {
    try {
      const response = await fetch(`${API_BASE_URL}/templates`)
      if (response.ok) return
    } catch {
      // keep retrying
    }
    await new Promise(r => setTimeout(r, 500))
  }
}

export async function fetchTemplates(): Promise<Template[]> {
  const response = await fetch(`${API_BASE_URL}/templates`)
  const body = await parseJsonResponse(response)
  if (!response.ok) throw new Error(extractErrorMessage(body, response.status))
  if (!Array.isArray(body)) return []
  return (body as Record<string, unknown>[]).map(t => ({
    id: t['id'] as number,
    name: (t['name'] as string) || '',
    pdf_path: (t['pdf_path'] as string) || '',
    fields: (t['fields'] as Record<string, string>) || {},
  }))
}

export async function createTemplate(payload: {
  name: string
  pdf_path: string
  fields: Record<string, string>
}): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}/templates/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await parseJsonResponse(response)
  if (!response.ok) throw new Error(extractErrorMessage(body, response.status))
  return body as Record<string, unknown>
}

export async function uploadTemplatePdf(
  file: File,
  directory: string = DEFAULT_TEMPLATE_DIRECTORY
): Promise<Record<string, unknown>> {
  const formData = new FormData()
  formData.append('file', file, file.name)
  formData.append('directory', directory)
  const response = await fetch(`${API_BASE_URL}/templates/upload`, {
    method: 'POST',
    body: formData,
  })
  const body = await parseJsonResponse(response)
  if (!response.ok) throw new Error(extractErrorMessage(body, response.status))
  return body as Record<string, unknown>
}

export async function makeFillable(pdfPath: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}/templates/make-fillable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdf_path: pdfPath }),
  })
  const body = await parseJsonResponse(response)
  if (!response.ok) throw new Error(extractErrorMessage(body, response.status))
  return body as Record<string, unknown>
}

export async function fetchModels(): Promise<{ models: string[]; default: string }> {
  const response = await fetch(`${API_BASE_URL}/forms/models`)
  const body = await parseJsonResponse(response)
  if (!response.ok) throw new Error(extractErrorMessage(body, response.status))
  return body as { models: string[]; default: string }
}

export async function fillTemplate(payload: {
  template_id: number
  input_text: string
  model?: string
}): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}/forms/fill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await parseJsonResponse(response)
  if (!response.ok) throw new Error(extractErrorMessage(body, response.status))
  return body as Record<string, unknown>
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const ext = (blob.type || '').split('/')[1]?.split(';')[0]?.trim() || 'webm'
  const formData = new FormData()
  formData.append('audio', blob, `recording.${ext}`)
  const response = await fetch(`${API_BASE_URL}/forms/transcribe`, {
    method: 'POST',
    body: formData,
  })
  const body = await parseJsonResponse(response)
  if (!response.ok) throw new Error(extractErrorMessage(body, response.status))
  return ((body as Record<string, unknown>)['text'] as string || '').trim()
}

export async function resolvePreviewUrl(path: string): Promise<string | null> {
  if (/^https?:\/\//i.test(path)) return path
  const candidate = `${API_BASE_URL}/templates/preview?path=${encodeURIComponent(path)}`
  try {
    const response = await fetch(candidate, { method: 'HEAD' })
    if (response.ok || response.status === 405) return candidate
  } catch {
    // unreachable
  }
  return null
}

export async function fetchWeatherForecast(
  latitude: number,
  longitude: number,
  start_date: string,
  end_date: string,
  fields?: string[]
): Promise<Record<string, unknown>> {
  let url = `${API_BASE_URL}/weather/forecast?latitude=${latitude}&longitude=${longitude}&start_date=${start_date}&end_date=${end_date}`
  if (fields && fields.length > 0) {
    url += `&fields=${encodeURIComponent(fields.join(','))}`
  }
  const response = await fetch(url)
  const body = await parseJsonResponse(response)
  if (!response.ok) throw new Error(extractErrorMessage(body, response.status))
  return body as Record<string, unknown>
}

export async function fetchAddressLookup(
  address: string
): Promise<Record<string, unknown>[]> {
  const url = `${API_BASE_URL}/zipcode/lookup-address?address=${encodeURIComponent(address)}`
  const response = await fetch(url)
  const body = await parseJsonResponse(response)
  if (!response.ok) throw new Error(extractErrorMessage(body, response.status))
  return body as Record<string, unknown>[]
}

export interface FormSubmissionData {
  id: number
  template_id: number
  template_name: string
  input_text: string
  output_pdf_path: string
  created_at: string | null
}
export interface AnalyticsData {
  total_submissions: number
  by_template: { template_name: string; count: number }[]
  by_date: { date: string; count: number }[]
  common_terms: { word: string; count: number }[]
}
export async function fetchSubmissions(): Promise<FormSubmissionData[]> {
  const url = `${API_BASE_URL}/forms/submissions`
  const response = await fetch(url)
  const body = await parseJsonResponse(response)
  if (!response.ok) throw new Error(extractErrorMessage(body, response.status))
  return body as FormSubmissionData[]
}
export async function fetchAnalytics(): Promise<AnalyticsData> {
  const url = `${API_BASE_URL}/forms/submissions/analytics`
  const response = await fetch(url)
  const body = await parseJsonResponse(response)
  if (!response.ok) throw new Error(extractErrorMessage(body, response.status))
  return body as AnalyticsData
}