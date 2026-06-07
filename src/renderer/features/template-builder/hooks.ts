import { useState, useCallback } from 'react'
import { FieldRow } from '../../types'
import { normalizeFieldType } from '../../lib/utils'

export function useFieldRows() {
  const [fieldRows, setFieldRows] = useState<FieldRow[]>([{ name: '', type: 'string' }])

  const addRow = useCallback(() => {
    setFieldRows(prev => [...prev, { name: '', type: 'string' }])
  }, [])

  const removeRow = useCallback((index: number) => {
    setFieldRows(prev => prev.filter((_, i) => i !== index))
  }, [])

  const updateRow = useCallback((index: number, updates: Partial<FieldRow>) => {
    setFieldRows(prev =>
      prev.map((row, i) => (i === index ? { ...row, ...updates } : row))
    )
  }, [])

  const moveRow = useCallback((fromIndex: number, toIndex: number) => {
    setFieldRows(prev => {
      const updated = [...prev]
      const [moved] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, moved)
      return updated
    })
  }, [])

  const seedFromApiFields = useCallback(
    (fields: Array<{ name: string; description?: string; type: string }>) => {
      const hasExisting = fieldRows.some(r => r.name.trim())
      if (hasExisting) {
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
    [fieldRows]
  )

  const resetRows = useCallback(() => {
    setFieldRows([{ name: '', type: 'string' }])
  }, [])

  return { fieldRows, addRow, removeRow, updateRow, moveRow, seedFromApiFields, resetRows }
}
