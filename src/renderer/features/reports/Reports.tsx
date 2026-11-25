import { useState } from 'react'
import {
  CalendarRange,
  Download,
  FileChartColumn,
  FileJson,
  FileText,
  LoaderCircle,
  RotateCw,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useStore, type ActiveReport } from '../../store'
import {
  generateReport,
  ReportApiError,
  type GenerateReportRequest,
  type PeriodicReport,
  type PeriodType,
  type ReportFormat,
} from '../../lib/api'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { cn } from '../../lib/utils'
import { useTranslation } from '../../lib/i18n'
import {
  describePeriod,
  downloadBlob,
  isFuturePeriod,
  useNow,
  useReportPolling,
  type PeriodSelection,
} from './hooks'

const MIN_YEAR = 2000

const SELECT_CLASS =
  'flex h-8 w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-50'

export function Reports() {
  const { t } = useTranslation()
  const { activeReport, setActiveReport } = useStore(s => ({
    activeReport: s.activeReport,
    setActiveReport: s.setActiveReport,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">{t.reports.title}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {t.reports.subtitle}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        <ReportRequestForm onStarted={job => setActiveReport({ ...job, startedAt: Date.now() })} />

        {activeReport ? (
          <ReportJobPanel
            key={`${activeReport.reportId}:${activeReport.startedAt}`}
            job={activeReport}
            onRetry={() => setActiveReport({ ...activeReport, startedAt: Date.now() })}
            onClose={() => setActiveReport(null)}
          />
        ) : (
          <div className="p-12 text-center bg-white border border-dashed border-zinc-200 rounded-lg">
            <FileChartColumn className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-800">{t.reports.noReportYet}</p>
            <p className="text-xs text-zinc-500 mt-1">
              {t.reports.noReportDesc}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Request form ─────────────────────────────────────────────────────────────

function ReportRequestForm({ onStarted }: { onStarted: (job: Omit<ActiveReport, 'startedAt'>) => void }) {
  const { t } = useTranslation()
  const now = new Date()
  const currentYear = now.getFullYear()

  const [periodType, setPeriodType] = useState<PeriodType>('monthly')
  const [year, setYear] = useState(String(currentYear))
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1)
  const [format, setFormat] = useState<ReportFormat>('pdf')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const periodOptions: { value: PeriodType; label: string }[] = [
    { value: 'monthly', label: t.reports.monthly },
    { value: 'quarterly', label: t.reports.quarterly },
    { value: 'annual', label: t.reports.annual },
  ]

  const formatOptions: { value: ReportFormat; label: string; icon: typeof FileText; hint: string }[] = [
    { value: 'pdf', label: 'PDF', icon: FileText, hint: t.reports.pdfHint },
    { value: 'json', label: 'JSON', icon: FileJson, hint: t.reports.jsonHint },
  ]

  const yearNumber = Number(year)
  const yearValid = Number.isInteger(yearNumber) && yearNumber >= MIN_YEAR && yearNumber <= currentYear
  const selection: PeriodSelection = { periodType, year: yearNumber, month, quarter }
  const future = yearValid && isFuturePeriod(selection, now)
  const periodDesc = yearValid ? describePeriod(selection) : { label: '', fileStem: '' }
  const displayLabel = yearValid
    ? (periodType === 'monthly'
        ? `${t.reports.months[month - 1]} ${yearNumber}`
        : periodType === 'quarterly'
        ? `Q${quarter} ${yearNumber}`
        : `${yearNumber}`)
    : ''
  const canSubmit = yearValid && !future && !submitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const payload: GenerateReportRequest = {
      period_type: periodType,
      year: yearNumber,
      format,
      ...(periodType === 'monthly' ? { month } : {}),
      ...(periodType === 'quarterly' ? { quarter } : {}),
    }
    try {
      const response = await generateReport(payload)
      onStarted({
        reportId: response.report_id,
        format,
        periodLabel: displayLabel || periodDesc.label,
        fileStem: periodDesc.fileStem,
      })
    } catch (err) {
      if (err instanceof ReportApiError && err.code === 'QUEUE_UNAVAILABLE') {
        setError(t.reports.queueUnavailable)
      } else if (err instanceof TypeError) {
        setError(t.reports.backendUnreachable)
      } else {
        setError(err instanceof Error ? err.message : t.reports.failedToStart)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
          <CalendarRange className="w-4 h-4 text-zinc-500" />
          {t.reports.newReport}
        </CardTitle>
        <CardDescription className="text-xs">{t.reports.newReportDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-zinc-700">{t.reports.period}</span>
            <div className="grid grid-cols-3 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-xs" role="radiogroup" aria-label={t.reports.period}>
              {periodOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={periodType === option.value}
                  onClick={() => setPeriodType(option.value)}
                  className={cn(
                    'px-2 py-1 rounded-md font-semibold transition-all',
                    periodType === option.value ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={cn('grid gap-3', periodType === 'annual' ? 'grid-cols-1' : 'grid-cols-2')}>
            <label className="space-y-1.5 block">
              <span className="text-[11px] font-semibold text-zinc-700">{t.reports.year}</span>
              <Input
                type="number"
                inputMode="numeric"
                min={MIN_YEAR}
                max={currentYear}
                value={year}
                onChange={e => setYear(e.target.value)}
                aria-invalid={!yearValid}
              />
            </label>

            {periodType === 'monthly' && (
              <label className="space-y-1.5 block">
                <span className="text-[11px] font-semibold text-zinc-700">{t.reports.month}</span>
                <select className={SELECT_CLASS} value={month} onChange={e => setMonth(Number(e.target.value))}>
                  {t.reports.months.map((name, index) => (
                    <option
                      key={name}
                      value={index + 1}
                      disabled={yearValid && isFuturePeriod({ ...selection, month: index + 1 }, now)}
                    >
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {periodType === 'quarterly' && (
              <label className="space-y-1.5 block">
                <span className="text-[11px] font-semibold text-zinc-700">{t.reports.quarter}</span>
                <select className={SELECT_CLASS} value={quarter} onChange={e => setQuarter(Number(e.target.value))}>
                  {[1, 2, 3, 4].map(q => (
                    <option
                      key={q}
                      value={q}
                      disabled={yearValid && isFuturePeriod({ ...selection, quarter: q }, now)}
                    >
                      Q{q} ({t.reports.months[(q - 1) * 3].slice(0, 3)}–{t.reports.months[(q - 1) * 3 + 2].slice(0, 3)})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-zinc-700">{t.reports.format}</span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.reports.format}>
              {formatOptions.map(option => {
                const Icon = option.icon
                const selected = format === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setFormat(option.value)}
                    className={cn(
                      'rounded-lg border p-2.5 text-left transition-all',
                      selected ? 'border-zinc-900 bg-zinc-50 shadow-xs' : 'border-zinc-200 bg-white hover:border-zinc-300'
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900">
                      <Icon className="w-3.5 h-3.5" />
                      {option.label}
                    </span>
                    <span className="block text-[10px] text-zinc-500 mt-0.5">{option.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {!yearValid && (
            <p className="text-[11px] text-red-700">{t.reports.enterYearBetween} {MIN_YEAR} {t.reports.and} {currentYear}.</p>
          )}
          {future && (
            <p className="text-[11px] text-red-700">{displayLabel} {t.reports.inFuture}</p>
          )}
          {error && (
            <div className="flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700" role="alert">
              <TriangleAlert className="w-3.5 h-3.5 mt-px flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {submitting ? (
              <LoaderCircle className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <FileChartColumn className="w-3.5 h-3.5 mr-1.5" />
            )}
            {displayLabel ? `${t.reports.generateReport} (${displayLabel})` : t.reports.generateReport}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Job status and result ────────────────────────────────────────────────────

function ReportJobPanel({
  job,
  onRetry,
  onClose,
}: {
  job: ActiveReport
  onRetry: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const state = useReportPolling(job)
  const now = useNow(state.phase === 'processing')

  if (state.phase === 'processing') {
    const elapsed = Math.max(0, Math.round((now - job.startedAt) / 1000))
    const nextIn = state.nextPollAt ? Math.max(0, Math.ceil((state.nextPollAt - now) / 1000)) : null
    return (
      <Card>
        <CardContent className="p-10 flex flex-col items-center text-center" role="status" aria-live="polite">
          <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-semibold text-zinc-900">{t.reports.generatingReport.replace('{period}', job.periodLabel)}</p>
          <p className="text-xs text-zinc-500 mt-1">
            {job.format.toUpperCase()} · {t.reports.runningFor} {elapsed}{t.reports.seconds}
            {nextIn !== null && ` · ${t.reports.checkingAgainIn} ${nextIn}${t.reports.seconds}`}
          </p>
          <p className="text-[11px] text-zinc-400 mt-3">{t.reports.backgroundNotice}</p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={onClose}>
            {t.reports.stopWaiting}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (state.phase === 'error') {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="p-6 text-center" role="alert">
          <TriangleAlert className="w-6 h-6 text-red-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-red-900">
            {state.timedOut ? t.reports.reportTakingTooLong : t.reports.couldNotGetReport.replace('{period}', job.periodLabel)}
          </p>
          <p className="text-xs text-red-700 mt-1">{state.message}</p>
          {state.code && <p className="text-[10px] font-mono text-red-500 mt-1">{state.code}</p>}
          <div className="flex justify-center gap-2 mt-4">
            {state.code !== 'REPORT_NOT_FOUND' && state.code !== 'REPORT_FAILED' && (
              <Button onClick={onRetry} variant="outline" size="sm" className="bg-white">
                <RotateCw className="w-3.5 h-3.5 mr-1.5" />
                {t.reports.checkAgain}
              </Button>
            )}
            <Button onClick={onClose} variant="outline" size="sm" className="bg-white">
              <X className="w-3.5 h-3.5 mr-1.5" />
              {t.reports.startOver}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (state.phase === 'pdf') {
    return (
      <Card>
        <CardContent className="p-10 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3">
            <FileText className="w-5 h-5 text-emerald-700" />
          </div>
          <p className="text-sm font-semibold text-zinc-900">{t.reports.reportReady.replace('{period}', job.periodLabel)}</p>
          <p className="text-xs text-zinc-500 mt-1 font-mono">
            {state.filename} · {formatBytes(state.blob.size)}
          </p>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => downloadBlob(state.blob, state.filename)}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {t.reports.downloadPdf}
            </Button>
            <Button variant="outline" onClick={onClose}>
              {t.reports.newReportBtn}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return <JsonReportView report={state.report} fileStem={job.fileStem} onClose={onClose} />
}

// ── JSON report view ─────────────────────────────────────────────────────────

function JsonReportView({
  report,
  fileStem,
  onClose,
}: {
  report: PeriodicReport
  fileStem: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { summary, submissions } = report
  const { setPreviewPath, setActiveTab } = useStore(s => ({
    setPreviewPath: s.setPreviewPath,
    setActiveTab: s.setActiveTab,
  }))

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `${fileStem}.json`)
  }

  const templateEntries = Object.entries(summary.by_template)
  const mostActiveTemplate = templateEntries.length > 0 ? templateEntries[0][0] : '—'

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            {report.period_label}
            <Badge variant="outline" className="text-[10px] font-mono capitalize">{report.period_type}</Badge>
          </h2>
          <p className="text-[11px] text-zinc-500 font-mono">
            {formatDate(summary.date_from)} – {formatDate(summary.date_to)} · {t.reports.generated} {formatDateTime(report.generated_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {t.reports.downloadJson}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t.reports.newReportBtn}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label={t.reports.totalSubmissions} value={summary.total_submissions} />
        <StatCard label={t.reports.templatesUsed} value={templateEntries.length} />
        <StatCard label={t.reports.mostActiveTemplate} value={mostActiveTemplate} />
      </div>

      <BreakdownCard title={t.reports.submissionsByTemplate} data={summary.by_template} barClass="bg-red-600" emptyText={t.reports.noDataForPeriod} />

      {summary.groups.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-900">{t.reports.breakdownByPeriod}</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-left text-xs">
              <thead className="text-zinc-500 uppercase font-mono text-[10px] border-b border-zinc-200">
                <tr>
                  <th className="py-2">{t.reports.period}</th>
                  <th className="py-2 text-right">{t.reports.submissions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {summary.groups.map(group => (
                  <tr key={group.period}>
                    <td className="py-2 font-medium text-zinc-900">{group.period}</td>
                    <td className="py-2 text-right font-mono">{group.submission_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-zinc-900">{t.reports.formSubmissions} ({submissions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <p className="py-6 text-center text-xs text-zinc-400">{t.reports.noSubmissionsInPeriod}</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white text-zinc-500 uppercase font-mono text-[10px] border-b border-zinc-200">
                  <tr>
                    <th className="py-2 pr-2">{t.reports.id}</th>
                    <th className="py-2 pr-2">{t.reports.dateTime}</th>
                    <th className="py-2 pr-2">{t.reports.template}</th>
                    <th className="py-2 pr-2">{t.reports.inputPreview}</th>
                    <th className="py-2 text-right">{t.reports.pdf}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {submissions.map(sub => (
                    <tr key={sub.id} className="hover:bg-zinc-50/80">
                      <td className="py-2 pr-2 font-mono text-zinc-900">
                        #{sub.id}
                      </td>
                      <td className="py-2 pr-2 font-mono text-zinc-600">
                        {sub.created_at ? formatDateTime(sub.created_at) : '—'}
                      </td>
                      <td className="py-2 pr-2">
                        <Badge variant="secondary" className="text-[10px]">{sub.template_name || 'Unknown'}</Badge>
                      </td>
                      <td className="py-2 pr-2 text-zinc-700 max-w-[200px] truncate" title={sub.input_text || ''}>
                        {sub.input_text || '—'}
                      </td>
                      <td className="py-2 text-right">
                        {sub.output_pdf_path ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[11px] px-2"
                            onClick={() => {
                              setPreviewPath(sub.output_pdf_path)
                              setActiveTab('pdfPreviewer')
                            }}
                          >
                            {t.reports.preview}
                          </Button>
                        ) : (
                          <span className="text-zinc-400 font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardDescription className="uppercase font-mono text-[10px]">{label}</CardDescription>
        <CardTitle className="text-2xl font-black tracking-tight text-zinc-900 mt-1">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function BreakdownCard({
  title,
  data,
  barClass,
  emptyText = 'No data for this period.',
}: {
  title: string
  data: Record<string, number>
  barClass: string
  emptyText?: string
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(([, count]) => count))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-zinc-900">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {entries.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-400">{emptyText}</p>
        ) : (
          entries.map(([key, count]) => (
            <div key={key}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-medium text-zinc-700">{humanize(key)}</span>
                <span className="font-mono text-zinc-500">{count}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                <div className={cn('h-full rounded-full', barClass)} style={{ width: `${(count / max) * 100}%` }} />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

// ── Formatting helpers ───────────────────────────────────────────────────────

function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Calendar dates ("2026-07-01") are parsed as local dates so they don't shift a day in
// timezones west of UTC.
function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
