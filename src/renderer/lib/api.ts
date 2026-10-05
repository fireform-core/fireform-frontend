import { API_BASE_URL, DEFAULT_TEMPLATE_DIRECTORY } from './constants'
import type { Template } from '../types'

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
    fields: (t['fields'] as Record<string, any>) || {},
    field_count: typeof t['field_count'] === 'number' ? (t['field_count'] as number) : undefined,
  }))
}

export async function createTemplate(payload: {
  name: string
  pdf_path: string
  fields?: Record<string, any>
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

export async function deleteTemplate(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/templates/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const body = await parseJsonResponse(response)
    throw new Error(extractErrorMessage(body, response.status))
  }
}

export async function fetchModels(): Promise<{ models: string[]; default: string }> {
  const response = await fetch(`${API_BASE_URL}/forms/models`)
  const body = await parseJsonResponse(response)
  if (!response.ok) throw new Error(extractErrorMessage(body, response.status))
  return body as { models: string[]; default: string }
}

type FillTemplatePayload = {
  template_id: number
  input_text: string
  model?: string
}

type FillSignature = { certificate: File; password: string }

export function fillTemplate(payload: FillTemplatePayload): Promise<Record<string, unknown>>
export function fillTemplate(
  payload: FillTemplatePayload,
  signature: FillSignature
): Promise<Record<string, unknown> | Blob>
export async function fillTemplate(
  payload: FillTemplatePayload,
  signature?: FillSignature
): Promise<Record<string, unknown> | Blob> {
  let requestBody: BodyInit
  const headers: HeadersInit = {}

  if (signature) {
    const formData = new FormData()
    formData.append('template_id', String(payload.template_id))
    formData.append('input_text', payload.input_text)
    if (payload.model) formData.append('model', payload.model)
    formData.append('sign', 'true')
    formData.append('cert_file', signature.certificate, signature.certificate.name)
    formData.append('cert_password', signature.password)
    requestBody = formData
  } else {
    headers['Content-Type'] = 'application/json'
    requestBody = JSON.stringify(payload)
  }

  const response = await fetch(`${API_BASE_URL}/forms/fill`, {
    method: 'POST',
    headers,
    body: requestBody,
  })
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (response.ok && (contentType.includes('application/pdf') || (signature && !contentType.includes('json')))) {
    return response.blob()
  }
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