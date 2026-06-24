export const API_BASE_URL = 'http://127.0.0.1:8000/api/v1'
export const DEFAULT_TEMPLATE_DIRECTORY = 'src/inputs'

export const FIELD_TYPES = [
  { label: 'Text', value: 'string' },
  { label: 'Long Text', value: 'long_text' },
  { label: 'Number', value: 'number' },
  { label: 'Date', value: 'date' },
  { label: 'Time', value: 'time' },
  { label: 'Email', value: 'email' },
  { label: 'Phone', value: 'phone' },
  { label: 'Signature', value: 'signature' },
  { label: 'Checkbox', value: 'checkbox' },
  { label: 'List', value: 'list' },
]

export const TYPE_VALUE_TO_LABEL: Record<string, string> = Object.fromEntries(
  FIELD_TYPES.map(t => [t.value, t.label])
)
