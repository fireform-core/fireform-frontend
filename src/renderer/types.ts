export interface Template {
  id: number
  name: string
  pdf_path: string
  fields: Record<string, string>
}

export interface FieldRow {
  name: string
  type: string
}
