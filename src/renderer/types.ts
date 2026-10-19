export interface Template {
  id: number
  name: string
  description: string
  pdf_path: string
  fields: Record<string, any>
  field_count?: number
}

export interface FieldRow {
  name: string
  description?: string
  type: string
}

export interface ExtractedField {
  name: string
  description: string
  type: string
}

