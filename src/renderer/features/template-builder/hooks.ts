import { useState, useCallback } from 'react'
import type { FieldRow } from '../../types'
import { normalizeFieldType } from '../../lib/utils'

type RowsSetter = (rows: FieldRow[] | ((prev: FieldRow[]) => FieldRow[])) => void

// Pass `external` to keep the rows somewhere longer-lived than the component (e.g. the store)
export function useFieldRows(external?: [FieldRow[], RowsSetter]) {
  const localRows = useState<FieldRow[]>([{ name: '', type: 'string' }])
  const [fieldRows, setFieldRows] = external ?? localRows

  const addRow = useCallback(() => {
    setFieldRows(prev => [...prev, { name: '', type: 'string' }])
  }, [setFieldRows])

  const removeRow = useCallback((index: number) => {
    setFieldRows(prev => prev.filter((_, i) => i !== index))
  }, [setFieldRows])

  const updateRow = useCallback((index: number, updates: Partial<FieldRow>) => {
    setFieldRows(prev =>
      prev.map((row, i) => (i === index ? { ...row, ...updates } : row))
    )
  }, [setFieldRows])

  const moveRow = useCallback((fromIndex: number, toIndex: number) => {
    setFieldRows(prev => {
      const updated = [...prev]
      const [moved] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, moved)
      return updated
    })
  }, [setFieldRows])

  const seedFromApiFields = useCallback(
    (fields: Array<{ name: string; description?: string; type: string }>, confirmReplace = true) => {
      const hasExisting = fieldRows.some(r => r.name.trim())
      if (confirmReplace && hasExisting) {
        const replace = window.confirm(
          `This PDF has ${fields.length} fillable field${fields.length === 1 ? '' : 's'}.\n\n` +
            'Replace your current form fields with them? Your existing entries will be lost.'
        )
        if (!replace) return 'kept'
      }
      setFieldRows(
        fields.map(f => ({
          name: f.description || f.name || '',
          type: normalizeFieldType(f.type),
        }))
      )
      return 'seeded'
    },
    [fieldRows, setFieldRows]
  )

  const resetRows = useCallback(() => {
    setFieldRows([{ name: '', type: 'string' }])
  }, [setFieldRows])

  return { fieldRows, addRow, removeRow, updateRow, moveRow, seedFromApiFields, resetRows }
}
