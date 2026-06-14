import { useRef, useState } from 'react'
import { FieldRow } from '../../types'
import { FIELD_TYPES } from '../../lib/constants'

interface FieldsBuilderProps {
  rows: FieldRow[]
  onUpdate: (index: number, updates: Partial<FieldRow>) => void
  onRemove: (index: number) => void
  onMove: (fromIndex: number, toIndex: number) => void
}

export function FieldsBuilder({ rows, onUpdate, onRemove, onMove }: FieldsBuilderProps) {
  const dragSourceRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function handleDragStart(e: React.DragEvent, index: number) {
    dragSourceRef.current = index
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    ;(e.currentTarget as HTMLElement).classList.add('is-dragging')
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  function handleDragLeave() {
    setDragOverIndex(null)
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault()
    setDragOverIndex(null)
    const from = dragSourceRef.current
    if (from !== null && from !== targetIndex) {
      onMove(from, targetIndex)
    }
    dragSourceRef.current = null
  }

  function handleDragEnd(e: React.DragEvent) {
    ;(e.currentTarget as HTMLElement).classList.remove('is-dragging')
    setDragOverIndex(null)
    dragSourceRef.current = null
  }

  return (
    <div className="fields-builder" aria-live="polite">
      {rows.map((row, index) => (
        <div
          key={index}
          className={`field-row${dragOverIndex === index ? ' drag-over' : ''}`}
          draggable
          data-index={index}
          onDragStart={e => handleDragStart(e, index)}
          onDragOver={e => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
        >
          <span className="field-drag-handle" aria-hidden="true">
            ⋮⋮
          </span>
          <input
            type="text"
            className="field-name"
            placeholder="Give description here"
            value={row.name}
            onChange={e => onUpdate(index, { name: e.target.value })}
          />
          <select
            className="field-type"
            value={row.type}
            onChange={e => onUpdate(index, { type: e.target.value })}
          >
            {FIELD_TYPES.map(t => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="field-delete-btn"
            aria-label="Remove field"
            onClick={() => onRemove(index)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
