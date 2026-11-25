import { useEffect, useState, useMemo } from 'react'
import {
  FileText,
  RotateCw,
  Eye,
  TrendingUp,
  BarChart3,
  Search,
  Activity,
  Calendar,
  Sparkles,
  X,
} from 'lucide-react'
import { useStore } from '../../store'
import { useTranslation } from '../../lib/i18n'
import type { FormSubmissionData, AnalyticsData } from '../../lib/api'
import { fetchSubmissions, fetchAnalytics } from '../../lib/api'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Input } from '../../components/ui/input'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/card'
import { cn } from '../../lib/utils'

export function Submissions() {
  const { t, language } = useTranslation()
  const { setActiveTab, setPreviewPath } = useStore(s => ({
    setActiveTab: s.setActiveTab,
    setPreviewPath: s.setPreviewPath,
  }))

  const [activeSubTab, setActiveSubTab] = useState<'list' | 'analytics'>('list')
  const [submissions, setSubmissions] = useState<FormSubmissionData[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInputText, setSelectedInputText] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [subs, stats] = await Promise.all([fetchSubmissions(), fetchAnalytics()])
      setSubmissions(subs)
      setAnalytics(stats)
    } catch (err: any) {
      setError(err?.message || t.submissions.failedToLoad)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleViewPdf = (pdfPath: string) => {
    setPreviewPath(pdfPath)
    setActiveTab('pdfPreviewer')
  }

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return 'N/A'
    try {
      const date = new Date(isoStr)
      return date.toLocaleDateString(language === 'es' ? 'es-ES' : undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoStr
    }
  }

  const filteredSubmissions = useMemo(() => {
    if (!searchQuery.trim()) return submissions
    const q = searchQuery.toLowerCase()
    return submissions.filter(
      s =>
        s.template_name?.toLowerCase().includes(q) ||
        s.input_text?.toLowerCase().includes(q) ||
        s.output_pdf_path?.toLowerCase().includes(q)
    )
  }, [submissions, searchQuery])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-medium text-zinc-500 font-mono">{t.submissions.loading}</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/50 p-6 text-center max-w-lg mx-auto">
        <p className="text-sm font-semibold text-red-900">{t.submissions.errorLoading}</p>
        <p className="text-xs text-red-700 mt-1">{error}</p>
        <Button onClick={loadData} variant="outline" size="sm" className="mt-4 bg-white">
          <RotateCw className="w-3.5 h-3.5 mr-1.5" />
          {t.submissions.retry}
        </Button>
      </Card>
    )
  }

  const totalSubmissions = submissions.length
  const topTemplate = analytics?.by_template?.[0]?.template_name || 'None'
  const topTemplateCount = analytics?.by_template?.[0]?.count || 0

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">{t.submissions.title}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {t.submissions.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-xs">
            <button
              type="button"
              onClick={() => setActiveSubTab('list')}
              className={cn(
                'px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5',
                activeSubTab === 'list'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              {t.submissions.generatedPdfs} ({totalSubmissions})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('analytics')}
              className={cn(
                'px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5',
                activeSubTab === 'analytics'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              )}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              {t.submissions.analyticsDashboard}
            </button>
          </div>

          <Button onClick={loadData} variant="outline" size="sm" className="h-8 bg-white text-xs">
            <RotateCw className="w-3.5 h-3.5 mr-1" />
            {t.submissions.refresh}
          </Button>
        </div>
      </div>

      {/* Sub-Tab 1: Generated PDFs List */}
      {activeSubTab === 'list' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t.submissions.filterPlaceholder}
                className="pl-8 text-xs bg-white"
              />
            </div>
            <span className="text-xs font-mono text-zinc-400">
              {t.submissions.showing} {filteredSubmissions.length} {t.submissions.of} {totalSubmissions} {t.submissions.records}
            </span>
          </div>

          {filteredSubmissions.length === 0 ? (
            <div className="p-12 text-center bg-white border border-dashed border-zinc-200 rounded-lg">
              <FileText className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-zinc-800">{t.submissions.noSubmissionsFound}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {t.submissions.noSubmissionsDesc}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5 w-16">{t.submissions.id}</th>
                    <th className="px-4 py-2.5 w-44">{t.submissions.dateTime}</th>
                    <th className="px-4 py-2.5 w-48">{t.submissions.template}</th>
                    <th className="px-4 py-2.5">{t.submissions.inputNarrative}</th>
                    <th className="px-4 py-2.5 text-right w-28">{t.submissions.action}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredSubmissions.map((sub, index) => {
                    const displayId = submissions.length - index
                    return (
                      <tr key={sub.id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono text-zinc-400">#{displayId}</td>
                        <td className="px-4 py-3 text-zinc-600 font-mono text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-zinc-400" />
                            <span>{formatDate(sub.created_at)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-zinc-900">
                          {sub.template_name}
                        </td>
                        <td
                          className="px-4 py-3 text-zinc-600 truncate max-w-md cursor-pointer hover:text-zinc-950 font-normal"
                          onClick={() => setSelectedInputText(sub.input_text)}
                          title={t.submissions.clickToViewTranscript}
                        >
                          {sub.input_text || <span className="text-zinc-400 italic">{t.submissions.directInput}</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="default"
                            size="xs"
                            onClick={() => handleViewPdf(sub.output_pdf_path)}
                            className="bg-zinc-900 text-white text-[11px]"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            {t.submissions.viewPdf}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 2: Analytics Dashboard */}
      {activeSubTab === 'analytics' && analytics && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="uppercase font-mono text-[10px]">
                  {t.submissions.totalDocsFiled}
                </CardDescription>
                <CardTitle className="text-2xl font-black tracking-tight text-zinc-900 mt-1">
                  {totalSubmissions}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-600" />
                  {t.submissions.autoFormatted}
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="uppercase font-mono text-[10px]">
                  {t.submissions.topTemplate}
                </CardDescription>
                <CardTitle className="text-lg font-bold text-zinc-900 mt-1 truncate">
                  {topTemplate}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {topTemplateCount} {topTemplateCount === 1 ? t.submissions.submissionSingular : t.submissions.submissionsPlural}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="uppercase font-mono text-[10px]">
                  {t.submissions.databaseEngine}
                </CardDescription>
                <CardTitle className="text-lg font-bold text-emerald-700 mt-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {t.submissions.liveSynchronized}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-[11px] text-zinc-500">{t.submissions.sqlModelReady}</span>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Chart 1: Volume Trend */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-zinc-900">
                      {t.submissions.volumeTrend}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t.submissions.volumeTrendDesc}
                    </CardDescription>
                  </div>
                  <TrendingUp className="w-4 h-4 text-zinc-400" />
                </div>
              </CardHeader>
              <CardContent>
                {analytics.by_date.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-xs text-zinc-400">
                    {t.submissions.notEnoughData}
                  </div>
                ) : (
                  <div className="h-44 w-full">
                    <VolumeTrendChart data={analytics.by_date} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chart 2: Template Usage Distribution */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-zinc-900">
                      {t.submissions.templateDistribution}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t.submissions.templateDistributionDesc}
                    </CardDescription>
                  </div>
                  <BarChart3 className="w-4 h-4 text-zinc-400" />
                </div>
              </CardHeader>
              <CardContent>
                {analytics.by_template.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-xs text-zinc-400">
                    {t.submissions.noTemplatesFilled}
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {analytics.by_template.map(tItem => {
                      const maxVal = Math.max(...analytics.by_template.map(item => item.count)) || 1
                      const pct = Math.round((tItem.count / maxVal) * 100)
                      return (
                        <div key={tItem.template_name} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="truncate max-w-[220px] text-zinc-800">{tItem.template_name}</span>
                            <span className="font-mono text-zinc-500 font-semibold">{tItem.count}</span>
                          </div>
                          <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className="h-full bg-zinc-900 rounded-full transition-all duration-500"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Section 3: Extracted Keywords & Symptoms */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                {t.submissions.extractedFacts}
              </CardTitle>
              <CardDescription className="text-xs">
                {t.submissions.extractedFactsDesc}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.common_terms.length === 0 ? (
                <p className="text-xs text-zinc-400 py-4 text-center">
                  {t.submissions.fillMoreForms}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {analytics.common_terms.map(term => (
                    <div
                      key={term.word}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-800 hover:bg-zinc-200 transition-colors"
                    >
                      <span className="capitalize">{term.word}</span>
                      <span className="font-mono text-[10px] text-zinc-500 font-bold bg-white px-1 rounded shadow-xs">
                        {term.count}×
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Input Narrative Modal Viewer */}
      {selectedInputText !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedInputText(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-zinc-200 max-w-lg w-full p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-bold text-zinc-900">{t.submissions.transcriptModalTitle}</h3>
              <button
                type="button"
                onClick={() => setSelectedInputText(null)}
                className="text-zinc-400 hover:text-zinc-900 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-md max-h-72 overflow-y-auto">
              <p className="text-xs font-mono text-zinc-800 whitespace-pre-wrap leading-relaxed">
                {selectedInputText || t.submissions.noTranscriptText}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setSelectedInputText(null)} className="bg-zinc-900 text-white">
                {t.submissions.close}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Volume Trend SVG Chart Component (Refactored to monochrome shadcn aesthetic)
function VolumeTrendChart({ data }: { data: { date: string; count: number }[] }) {
  const chartHeight = 150
  const chartWidth = 460
  const padding = { top: 10, right: 15, bottom: 25, left: 25 }
  const graphWidth = chartWidth - padding.left - padding.right
  const graphHeight = chartHeight - padding.top - padding.bottom
  const maxVal = Math.max(...data.map(d => d.count), 3)

  const points = data.map((d, index) => {
    const x = padding.left + (index / (data.length - 1 || 1)) * graphWidth
    const y = padding.top + graphHeight - (d.count / maxVal) * graphHeight
    return { x, y, date: d.date, count: d.count }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${points[0].x} ${
          padding.top + graphHeight
        } Z`
      : ''

  return (
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height="100%" className="overflow-visible">
      <defs>
        <linearGradient id="chartMonoGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#18181b" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#18181b" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Gridlines */}
      {[0, 0.5, 1].map(ratio => {
        const yVal = padding.top + graphHeight * ratio
        return (
          <line
            key={ratio}
            x1={padding.left}
            y1={yVal}
            x2={chartWidth - padding.right}
            y2={yVal}
            stroke="#f4f4f5"
            strokeDasharray="4 4"
          />
        )
      })}

      {/* Area */}
      {areaPath && <path d={areaPath} fill="url(#chartMonoGrad)" />}

      {/* Line */}
      {linePath && <path d={linePath} fill="none" stroke="#18181b" strokeWidth="2.5" strokeLinecap="round" />}

      {/* Points */}
      {points.map((p, idx) => (
        <circle
          key={idx}
          cx={p.x}
          cy={p.y}
          r="3.5"
          fill="#18181b"
          stroke="#fff"
          strokeWidth="1.5"
          className="cursor-pointer hover:r-5 transition-all"
        >
          <title>{`${p.date}: ${p.count} submissions`}</title>
        </circle>
      ))}

      {/* X Labels */}
      {points.map((p, idx) => {
        const showLabel =
          points.length <= 7 ||
          idx === 0 ||
          idx === points.length - 1 ||
          idx === Math.floor(points.length / 2)
        if (!showLabel) return null

        let dateLabel = p.date
        try {
          const parts = p.date.split('-')
          if (parts.length === 3) dateLabel = `${parts[1]}/${parts[2]}`
        } catch {}

        return (
          <text
            key={idx}
            x={p.x}
            y={chartHeight - 4}
            textAnchor="middle"
            fill="#a1a1aa"
            fontSize="10"
            fontWeight="500"
          >
            {dateLabel}
          </text>
        )
      })}
    </svg>
  )
}