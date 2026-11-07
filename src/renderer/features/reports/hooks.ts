import { useEffect, useState } from 'react'
import {
  fetchReportResult,
  ReportApiError,
  type PeriodicReport,
  type PeriodType,
} from '../../lib/api'
import type { ActiveReport } from '../../store'

// Stop polling after this long; generation normally takes well under a minute.
export const REPORT_POLL_TIMEOUT_MS = 10 * 60 * 1000

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export interface PeriodSelection {
  periodType: PeriodType
  year: number
  month: number
  quarter: number
}

// Mirrors ReportingService.validate_and_compute_bounds: the current (partial) month or
// quarter is allowed, anything after it is rejected with FUTURE_PERIOD.
export function isFuturePeriod(sel: PeriodSelection, now = new Date()): boolean {
  const year = now.getFullYear()
  if (sel.year > year) return true
  if (sel.year < year) return false
  if (sel.periodType === 'monthly') return sel.month > now.getMonth() + 1
  if (sel.periodType === 'quarterly') return sel.quarter > Math.floor(now.getMonth() / 3) + 1
  return false
}

// Same labels and file names the backend uses for the report, e.g. "Q3 2026" and
// "FireForm_Quarterly_2026-Q3".
export function describePeriod(sel: PeriodSelection): { label: string; fileStem: string } {
  if (sel.periodType === 'monthly') {
    const mm = String(sel.month).padStart(2, '0')
    return { label: `${MONTH_NAMES[sel.month - 1]} ${sel.year}`, fileStem: `FireForm_Monthly_${sel.year}-${mm}` }
  }
  if (sel.periodType === 'quarterly') {
    return { label: `Q${sel.quarter} ${sel.year}`, fileStem: `FireForm_Quarterly_${sel.year}-Q${sel.quarter}` }
  }
  return { label: `${sel.year}`, fileStem: `FireForm_Annual_${sel.year}` }
}

export function downloadBlob(blob: Blob, filename: string): void {
  // Electron shows its native save dialog for <a download>; no main-process handler needed.
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export type ReportPollState =
  | { phase: 'processing'; nextPollAt: number | null }
  | { phase: 'pdf'; blob: Blob; filename: string }
  | { phase: 'json'; report: PeriodicReport }
  | { phase: 'error'; message: string; code?: string; timedOut?: boolean }

function describeReportError(error: unknown): { message: string; code?: string } {
  if (error instanceof ReportApiError) {
    const hints: Record<string, string> = {
      REPORT_NOT_FOUND: 'The backend no longer has this report. Start a new one.',
      REPORT_FAILED: 'The backend could not generate this report. Check the worker logs and try again.',
      PDF_NOT_FOUND: 'The report finished but its PDF file is missing on the backend.',
    }
    return { message: (error.code && hints[error.code]) || error.message, code: error.code }
  }
  if (error instanceof TypeError) {
    return { message: 'Could not reach the backend at 127.0.0.1:8000.' }
  }
  return { message: error instanceof Error ? error.message : 'Unexpected error while fetching the report.' }
}

/**
 * Polls GET /reports/{id} until the report is ready, honouring retry_after_seconds.
 * Mount with key={`${reportId}:${startedAt}`} so a new job (or a retry) starts fresh.
 */
export function useReportPolling(job: ActiveReport): ReportPollState {
  const [state, setState] = useState<ReportPollState>({ phase: 'processing', nextPollAt: null })
  const { reportId, fileStem, startedAt } = job

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async () => {
      try {
        const result = await fetchReportResult(reportId, `${fileStem}.pdf`)
        if (cancelled) return
        if (result.state === 'processing') {
          if (Date.now() - startedAt > REPORT_POLL_TIMEOUT_MS) {
            setState({
              phase: 'error',
              message: 'The report is still being generated after 10 minutes. Check that the report worker is running.',
              timedOut: true,
            })
            return
          }
          const delay = result.retryAfterSeconds * 1000
          setState({ phase: 'processing', nextPollAt: Date.now() + delay })
          timer = setTimeout(poll, delay)
        } else if (result.state === 'pdf') {
          setState({ phase: 'pdf', blob: result.blob, filename: result.filename })
        } else {
          setState({ phase: 'json', report: result.report })
        }
      } catch (error) {
        if (!cancelled) setState({ phase: 'error', ...describeReportError(error) })
      }
    }

    void poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [reportId, fileStem, startedAt])

  return state
}

// Re-renders every `intervalMs` while `active`, for elapsed / countdown displays.
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs])
  return now
}
