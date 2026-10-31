import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { Button } from './ui/button'

export function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  error?: string | null
  fallbackFocus?: () => HTMLElement | null
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  busy = false,
  error = null,
  fallbackFocus,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const onCancelRef = useRef(onCancel)
  const busyRef = useRef(busy)
  const fallbackFocusRef = useRef(fallbackFocus)

  useEffect(() => {
    onCancelRef.current = onCancel
    busyRef.current = busy
    fallbackFocusRef.current = fallbackFocus
  }, [onCancel, busy, fallbackFocus])

  useEffect(() => {
    if (!isOpen) return
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    if (!dialog.open) dialog.showModal()
    cancelButtonRef.current?.focus()

    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ))
      if (!focusable.length) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    dialog.addEventListener('keydown', onKey)
    return () => {
      dialog.removeEventListener('keydown', onKey)
      if (dialog.open) dialog.close()
      if (previousFocus?.isConnected) previousFocus.focus()
      else fallbackFocusRef.current?.()?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      className="m-auto w-[min(24rem,calc(100vw-32px))] rounded-lg border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-zinc-950/45"
      onClick={e => {
        if (e.target === e.currentTarget && !busyRef.current) onCancelRef.current()
      }}
      onCancel={event => {
        event.preventDefault()
        if (!busyRef.current) onCancelRef.current()
      }}
    >
      <div>
        <div className="px-5 pt-5 pb-4 text-center">
          <span
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600"
            aria-hidden="true"
          >
            <TrashIcon size={22} />
          </span>
          <h3 id="confirm-dialog-title" className="text-sm font-semibold text-zinc-900">
            {title}
          </h3>
          <p id="confirm-dialog-message" className="mt-1 text-xs text-zinc-600">{message}</p>
          {error && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-3">
          <Button ref={cancelButtonRef} type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting…' : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
