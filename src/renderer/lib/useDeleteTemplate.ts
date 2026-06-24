import { useState } from 'react'
import { useStore } from '../store'
import { deleteTemplate } from './api'
import { Template } from '../types'

/**
 * Shared delete flow for templates, used by both the Templates page and the
 * Fill Form page. Holds the item awaiting confirmation plus busy/error state,
 * calls the backend, then optimistically removes it from the store.
 */
export function useDeleteTemplate() {
  const removeTemplate = useStore(s => s.removeTemplate)
  const [pending, setPending] = useState<Template | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function request(template: Template) {
    setError(null)
    setPending(template)
  }

  function cancel() {
    if (busy) return
    setPending(null)
    setError(null)
  }

  async function confirm() {
    if (!pending || busy) return
    setBusy(true)
    setError(null)
    try {
      await deleteTemplate(pending.id)
      removeTemplate(pending.id)
      setPending(null)
    } catch (e) {
      setError((e as Error).message || 'Could not delete. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return { pending, busy, error, request, cancel, confirm }
}
