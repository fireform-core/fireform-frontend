import { useState } from 'react'
import { useStore, selectStudioDraftDirty } from '../store'

/**
 * Opening a different template (or a new one) in Studio replaces the unsaved draft.
 * When the draft has unsaved changes, hold the request until the user confirms the
 * discard. Same pattern as useDeleteTemplate: render `pending` with ConfirmDialog.
 */
export function useStudioDiscardGuard() {
  const { activeTemplateId, setActiveTemplateId, setActiveTab, resetStudioDraft } = useStore(s => ({
    activeTemplateId: s.activeTemplateId,
    setActiveTemplateId: s.setActiveTemplateId,
    setActiveTab: s.setActiveTab,
    resetStudioDraft: s.resetStudioDraft,
  }))
  const isDirty = useStore(selectStudioDraftDirty)
  const draftName = useStore(s => s.studioDraft.templateName)
  const [pending, setPending] = useState<{ id: number | null } | null>(null)

  function go(id: number | null) {
    // Re-opening the active template keeps the draft; anything else starts from a fresh one
    if (id === null || id !== activeTemplateId) resetStudioDraft()
    setActiveTemplateId(id)
    setActiveTab('studio')
  }

  // Open `id` in Studio (null = New Template), asking first if that would drop unsaved work
  function open(id: number | null) {
    const replacesDraft = id === null || id !== activeTemplateId
    if (replacesDraft && isDirty) setPending({ id })
    else go(id)
  }

  function confirm() {
    if (pending) go(pending.id)
    setPending(null)
  }

  function cancel() {
    setPending(null)
  }

  return { pending, draftName, open, confirm, cancel }
}
