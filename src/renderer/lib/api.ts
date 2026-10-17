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
    // FireForm 422 body: { error_code, message, validation_errors: [{ field, issue }] }
    if (Array.isArray(b['validation_errors'])) {
      const first = b['validation_errors'][0] as Record<string, unknown> | undefined
      if (first && typeof first['issue'] === 'string') {
        return typeof first['field'] === 'string' && first['field']
          ? `${first['field']}: ${first['issue']}`
          : first['issue']
      }
    }
    // FireForm AppError body: { error_code, message, detail? }
    if (typeof b['message'] === 'string') return b['message']
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

export type BackendStatus = 'connected' | 'degraded' | 'disconnected'

// GET /health: 200 = healthy/degraded, 503 = unhealthy (database down).
export async function fetchBackendStatus(): Promise<{ status: BackendStatus; detail: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(10000) })
    const body = (await parseJsonResponse(response)) as Record<string, unknown>
    const components = (body['components'] || {}) as Record<string, { status?: string }>
    const down = Object.entries(components)
      .filter(([, c]) => c?.status && c.status !== 'healthy')
      .map(([name, c]) => `${name}: ${c.status}`)
      .join(', ')
    if (!response.ok) return { status: 'disconnected', detail: down || `Backend returned ${response.status}` }
    return body['status'] === 'degraded'
      ? { status: 'degraded', detail: down }
      : { status: 'connected', detail: 'All backend services healthy' }
  } catch {
    return { status: 'disconnected', detail: 'Backend not reachable at 127.0.0.1:8000' }
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
    description: (t['description'] as string) || '',
    pdf_path: (t['pdf_path'] as string) || '',
    fields: (t['fields'] as Record<string, any>) || {},
    field_count: typeof t['field_count'] === 'number' ? (t['field_count'] as number) : undefined,
  }))
}

export async function createTemplate(payload: {
  name: string
  description: string
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

// PUT /templates/{id}: only the keys sent are changed; pdf_path is kept as-is.
export async function updateTemplate(
  id: number,
  payload: { name?: string; fields?: Record<string, unknown> }
): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}/templates/${id}`, {
    method: 'PUT',
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

export interface ModelInfo {
  name: string
  installed: boolean
  recommended: boolean
}

export interface ModelsResponse {
  current_model: string
  models: ModelInfo[]
}

export interface ModelProgress {
  status: string
  completed?: number
  total?: number
}

export async function listModels(): Promise<ModelsResponse> {
  const response = await fetch(`${API_BASE_URL}/forms/models`)
  const body = await parseJsonResponse(response)
  if (!response.ok) throw new Error(extractErrorMessage(body, response.status))
  return body as ModelsResponse
}

export async function fetchModels(): Promise<{ models: ModelInfo[]; default: string }> {
  const data = await listModels()
  return {
    models: data.models,
    default: data.current_model,
  }
}

export async function pullModel(
  model: string,
  onProgress: (progress: ModelProgress) => void
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/forms/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  })
  if (!response.ok) {
    const body = await parseJsonResponse(response)
    throw new Error(extractErrorMessage(body, response.status))
  }
  if (!response.body) throw new Error('Model download did not return a stream.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let completed = false

  const processLine = (line: string): void => {
    if (!line.trim()) return
    const event = JSON.parse(line) as Record<string, unknown>
    if (typeof event['error'] === 'string') throw new Error(event['error'])

    const progress: ModelProgress = {
      status: typeof event['status'] === 'string' ? event['status'] : '',
      completed: typeof event['completed'] === 'number' ? event['completed'] : undefined,
      total: typeof event['total'] === 'number' ? event['total'] : undefined,
    }
    onProgress(progress)
    if (progress.status === 'success') completed = true
  }

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) processLine(line)
    if (done) break
  }
  if (buffer.trim()) processLine(buffer)
  if (!completed) throw new Error('Model download ended without success.')
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
  if (!response.ok) {
    if (
      response.status === 422 &&
      body &&
      typeof body === 'object' &&
      (body as Record<string, unknown>)['error_code'] === 'MODEL_NOT_INSTALLED'
    ) {
      throw new Error('Model is not installed. Open Settings to download it.')
    }
    throw new Error(extractErrorMessage(body, response.status))
  }
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
    // FastAPI answers HEAD on GET routes with 405, so probe with GET and drop the body.
    const response = await fetch(candidate)
    response.body?.cancel().catch(() => {})
    if (response.ok) return candidate
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