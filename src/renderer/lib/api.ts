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

export interface LLMModelInfo {
  name: string
  size_gb?: number
  quantization?: string
  loaded?: boolean
  installed?: boolean
  manual?: boolean
}

export interface DownloadableModelInfo {
  name: string
  installed: false
}

export interface LLMModelChoice {
  provider: string
  model: string
}

export interface LLMProviderModels {
  provider: string
  available: boolean
  default_model?: string | null
  detail?: string | null
  error_code?: string | null
  models: LLMModelInfo[]
  downloadable?: DownloadableModelInfo[]
}

export type LLMProviderName = 'ollama' | 'gemini' | 'openai' | 'anthropic' | 'custom' | 'llama_cpp'

export interface LLMModelsResponse {
  default: LLMModelChoice
  providers: LLMProviderModels[]
}

export interface LLMProviderConfig {
  provider: LLMProviderName
  configured: boolean
  source: 'env' | 'ui' | 'none'
  key_hint?: string | null
  enabled: boolean
  external: boolean
  credential_status?: 'available' | 'unavailable' | null
  base_url?: string | null
  structured_output?: boolean | null
}

export interface LLMProviderConfigRequest {
  api_key?: string
  base_url?: string
  structured_output?: boolean
}

export interface LLMProviderValidationResult {
  provider: LLMProviderName
  ok: boolean
  models: LLMModelInfo[]
  detail?: string | null
  error_code?: string | null
}

export interface LLMManualModelResult {
  provider: LLMProviderName
  model: string
  ok: boolean
  detail?: string | null
  error_code?: string | null
}

export interface LLMExternalConsent {
  allow_external: boolean
  source: 'env' | 'ui' | 'none'
}

export class LLMApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly statusCode?: number
  ) {
    super(message)
    this.name = 'LLMApiError'
  }
}

function llmApiError(body: unknown, statusCode: number): LLMApiError {
  if (body && typeof body === 'object') {
    const value = body as Record<string, unknown>
    const code = typeof value['error_code'] === 'string' ? value['error_code'] : undefined
    const message = typeof value['message'] === 'string'
      ? value['message']
      : extractErrorMessage(body, statusCode)
    return new LLMApiError(message, code, statusCode)
  }
  return new LLMApiError(extractErrorMessage(body, statusCode), undefined, statusCode)
}

export function describeLLMError(error: unknown): string {
  const code = error instanceof LLMApiError ? error.code : undefined
  const detail = error instanceof Error ? error.message : 'An unexpected error occurred.'
  const descriptions: Record<string, string> = {
    LLM_AUTH_FAILED: 'The provider rejected the API key. Check the key and try again.',
    LLM_EXTERNAL_CONSENT_REQUIRED: 'Allow sending data to external services before saving this provider.',
    LLM_SECRET_KEY_UNAVAILABLE: 'FireForm cannot read or create its credential-encryption key.',
    LLM_NOT_AVAILABLE: 'This provider or model is not currently available in FireForm.',
    LLM_UNAVAILABLE: 'FireForm could not reach the provider. Check its URL and connection.',
    LLM_MODEL_NOT_FOUND: 'The provider does not offer this model ID.',
    LLM_RATE_LIMITED: 'The provider is rate-limiting requests or the account has no quota.',
    LLM_BAD_RESPONSE: 'The provider refused the request or returned an unsupported response.',
    LLM_CONFIG_ERROR: 'The provider configuration is invalid. Check the URL and options.',
  }
  if (!code) return detail
  const summary = descriptions[code] || 'The provider request failed.'
  return `${summary} (${code})${detail && detail !== summary ? ` ${detail}` : ''}`
}

export interface ModelProgress {
  status: string
  completed?: number
  total?: number
}

export async function fetchLLMModels(refresh = false): Promise<LLMModelsResponse> {
  const query = refresh ? '?refresh=true' : ''
  const response = await fetch(`${API_BASE_URL}/system/llm/models${query}`)
  const body = await parseJsonResponse(response)
  if (!response.ok) throw llmApiError(body, response.status)
  return body as LLMModelsResponse
}

export async function fetchLLMProviderConfigs(): Promise<LLMProviderConfig[]> {
  const response = await fetch(`${API_BASE_URL}/system/llm/providers/config`)
  const body = await parseJsonResponse(response)
  if (!response.ok) throw llmApiError(body, response.status)
  return (body as { providers: LLMProviderConfig[] }).providers
}

export async function saveLLMProviderConfig(
  provider: Exclude<LLMProviderName, 'ollama'>,
  config: LLMProviderConfigRequest
): Promise<LLMProviderConfig> {
  const response = await fetch(`${API_BASE_URL}/system/llm/providers/config/${provider}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  const body = await parseJsonResponse(response)
  if (!response.ok) throw llmApiError(body, response.status)
  return body as LLMProviderConfig
}

export async function deleteLLMProviderConfig(
  provider: Exclude<LLMProviderName, 'ollama'>
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/system/llm/providers/config/${provider}`, {
    method: 'DELETE',
  })
  const body = await parseJsonResponse(response)
  if (!response.ok) throw llmApiError(body, response.status)
}

export async function validateLLMProviderConfig(
  provider: Exclude<LLMProviderName, 'ollama'>,
  config: LLMProviderConfigRequest
): Promise<LLMProviderValidationResult> {
  const response = await fetch(`${API_BASE_URL}/system/llm/providers/config/${provider}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  const body = await parseJsonResponse(response)
  if (!response.ok) throw llmApiError(body, response.status)
  return body as LLMProviderValidationResult
}

export async function addLLMManualModel(
  provider: Exclude<LLMProviderName, 'ollama'>,
  model: string
): Promise<LLMManualModelResult> {
  const response = await fetch(`${API_BASE_URL}/system/llm/providers/config/${provider}/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  })
  const body = await parseJsonResponse(response)
  if (!response.ok) throw llmApiError(body, response.status)
  return body as LLMManualModelResult
}

export async function deleteLLMManualModel(
  provider: Exclude<LLMProviderName, 'ollama'>,
  model: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/system/llm/providers/config/${provider}/models`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  })
  const body = await parseJsonResponse(response)
  if (!response.ok) throw llmApiError(body, response.status)
}

export async function fetchLLMExternalConsent(): Promise<LLMExternalConsent> {
  const response = await fetch(`${API_BASE_URL}/system/llm/external-consent`)
  const body = await parseJsonResponse(response)
  if (!response.ok) throw llmApiError(body, response.status)
  return body as LLMExternalConsent
}

export async function setLLMExternalConsent(allowExternal: boolean): Promise<LLMExternalConsent> {
  const response = await fetch(`${API_BASE_URL}/system/llm/external-consent`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ allow_external: allowExternal }),
  })
  const body = await parseJsonResponse(response)
  if (!response.ok) throw llmApiError(body, response.status)
  return body as LLMExternalConsent
}

export async function pullModel(
  model: string,
  onProgress: (progress: ModelProgress) => void
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/system/llm/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'ollama', model }),
  })
  if (!response.ok) {
    const body = await parseJsonResponse(response)
    throw llmApiError(body, response.status)
  }
  if (!response.body) throw new Error('Model download did not return a stream.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sawSuccess = false
  let streamError = ''

  const processLine = (line: string): void => {
    if (!line.trim()) return
    let event: Record<string, unknown>
    try {
      event = JSON.parse(line) as Record<string, unknown>
    } catch {
      throw new Error('Model download returned invalid progress data.')
    }
    if (typeof event['error'] === 'string') {
      streamError = event['error']
      return
    }

    const progress: ModelProgress = {
      status: typeof event['status'] === 'string' ? event['status'] : '',
      completed: typeof event['completed'] === 'number' ? event['completed'] : undefined,
      total: typeof event['total'] === 'number' ? event['total'] : undefined,
    }
    onProgress(progress)
    if (progress.status === 'success') sawSuccess = true
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
  if (streamError) throw new Error(streamError)
  if (!sawSuccess) throw new Error('Model download ended without success.')
}

export async function fillTemplate(payload: {
  template_id: number
  input_text: string
  provider?: string
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

export interface UserProfile {
  profile_id?: string
  name: string
  profession: string
  role: string
  description?: string | null
  custom_fields?: Record<string, string> | null
  created_at?: string
  updated_at?: string
}

export async function fetchProfile(): Promise<UserProfile | null> {
  const response = await fetch(`${API_BASE_URL}/profiles/`)
  if (response.status === 404) return null
  const body = await parseJsonResponse(response)
  if (!response.ok) throw new Error(extractErrorMessage(body, response.status))
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  if ('profile_id' in body || 'name' in body) return body as UserProfile
  return null
}

export async function saveProfile(payload: {
  profile_id?: string
  name: string
  profession: string
  role: string
  description?: string | null
  custom_fields?: Record<string, string>
}): Promise<UserProfile> {
  const url = payload.profile_id
    ? `${API_BASE_URL}/profiles/${payload.profile_id}`
    : `${API_BASE_URL}/profiles/`
  const method = payload.profile_id ? 'PATCH' : 'POST'

  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      profession: payload.profession,
      role: payload.role,
      description: payload.description || null,
      custom_fields: payload.custom_fields || {},
    }),
  })
  const body = await parseJsonResponse(response)
  if (!response.ok) throw new Error(extractErrorMessage(body, response.status))
  return body as UserProfile
}