import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { fetchSubmissions, fetchAnalytics, FormSubmissionData, AnalyticsData } from '../../lib/api'
export function Submissions() {
    const { setActiveTab, setPreviewPath } = useStore(s => ({
        setActiveTab: s.setActiveTab,
        setPreviewPath: s.setPreviewPath,
    }))
    const [activeSubTab, setActiveSubTab] = useState<'list' | 'analytics'>('list')
    const [submissions, setSubmissions] = useState<FormSubmissionData[]>([])
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    // For input text modal viewer
    const [selectedInputText, setSelectedInputText] = useState<string | null>(null)
    const loadData = async () => {
        setLoading(true)
        setError(null)
        try {
            const [subs, stats] = await Promise.all([fetchSubmissions(), fetchAnalytics()])
            setSubmissions(subs)
            setAnalytics(stats)
        } catch (err: any) {
            setError(err?.message || 'Failed to load submissions and analytics data.')
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => {
        loadData()
    }, [])
    const handleViewPdf = (pdfPath: string) => {
        setPreviewPath(pdfPath)
        setActiveTab('pdfPreviewer')
    }
    // Format date helper
    const formatDate = (isoStr: string | null) => {
        if (!isoStr) return 'N/A'
        try {
            const date = new Date(isoStr)
            return date.toLocaleDateString(undefined, {
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
    if (loading) {
        return (
            <div className="card empty-state" style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                <p>Loading submissions and analytics...</p>
            </div>
        )
    }
    if (error) {
        return (
            <div className="card empty-state" style={{ borderColor: 'var(--error)' }}>
                <p className="helper error">Error loading data</p>
                <p>{error}</p>
                <button onClick={loadData} className="secondary-btn" style={{ marginTop: '10px' }}>
                    Retry
                </button>
            </div>
        )
    }
    // Calculate totals and statistics
    const totalSubmissions = submissions.length
    const topTemplate = analytics?.by_template?.[0]?.template_name || 'None'
    const topTemplateCount = analytics?.by_template?.[0]?.count || 0
    return (
        <div className="panel">
            {/* Sub navigation for this page */}
            <div className="horizontal-layout" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
                <div className="tabs" style={{ margin: 0 }}>
                    <button
                        type="button"
                        className={`tab ${activeSubTab === 'list' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('list')}
                        style={{ borderRadius: '8px', padding: '6px 16px' }}
                    >
                        Generated PDFs ({totalSubmissions})
                    </button>
                    <button
                        type="button"
                        className={`tab ${activeSubTab === 'analytics' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('analytics')}
                        style={{ borderRadius: '8px', padding: '6px 16px' }}
                    >
                        Analytics Dashboard
                    </button>
                </div>
                <button onClick={loadData} className="secondary-btn" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                    🔄 Refresh
                </button>
            </div>
            {activeSubTab === 'list' && (
                <div className="card">
                    <h2>Form Submissions</h2>
                    <p className="helper" style={{ marginBottom: '16px' }}>
                        List of all PDF files generated from forms. Click "View PDF" to open the previewer.
                    </p>
                    {submissions.length === 0 ? (
                        <div className="empty-state">No form submissions have been generated yet.</div>
                    ) : (
                        <table className="fields-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '60px' }}>ID</th>
                                    <th style={{ width: '180px' }}>Date</th>
                                    <th style={{ width: '180px' }}>Template</th>
                                    <th>Input Description</th>
                                    <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.map((sub, index) => {
                                    const displayId = submissions.length - index
                                    return (
                                        <tr key={sub.id}>
                                            <td>#{displayId}</td>
                                            <td>{formatDate(sub.created_at)}</td>
                                            <td style={{ fontWeight: 600 }}>{sub.template_name}</td>
                                            <td
                                                style={{
                                                    cursor: 'pointer',
                                                    color: 'var(--muted)',
                                                    maxWidth: '300px',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                                onClick={() => setSelectedInputText(sub.input_text)}
                                                title="Click to view full transcript/input"
                                            >
                                                {sub.input_text || '(No input text)'}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button
                                                    type="button"
                                                    className="tile-preview-btn"
                                                    onClick={() => handleViewPdf(sub.output_pdf_path)}
                                                    style={{ margin: 0 }}
                                                >
                                                    View PDF
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
            {activeSubTab === 'analytics' && analytics && (
                <div className="panel" style={{ gap: '20px' }}>
                    {/* Quick Metrics */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '14px',
                        }}
                    >
                        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
                            <span className="eyebrow" style={{ fontSize: '0.7rem' }}>Total Forms Generated</span>
                            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                                {totalSubmissions}
                            </span>
                        </div>
                        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
                            <span className="eyebrow" style={{ fontSize: '0.7rem' }}>Most Popular Template</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {topTemplate}
                            </span>
                            <span className="tile-meta" style={{ marginTop: '2px' }}>
                                {topTemplateCount} submissions
                            </span>
                        </div>
                        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
                            <span className="eyebrow" style={{ fontSize: '0.7rem' }}>Database Status</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '4px', color: 'var(--success)' }}>
                                Active & Connected
                            </span>
                            <span className="tile-meta" style={{ marginTop: '2px' }}>
                                Submissions syncing live
                            </span>
                        </div>
                    </div>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                            gap: '20px',
                        }}
                    >
                        {/* Chart 1: Volume Trend */}
                        <div className="card">
                            <h2>Submission Trend (Over Time)</h2>
                            <p className="tile-meta" style={{ marginBottom: '16px' }}>Number of forms generated per day</p>
                            {analytics.by_date.length === 0 ? (
                                <div className="empty-state" style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    Not enough historical data yet.
                                </div>
                            ) : (
                                <div style={{ position: 'relative', width: '100%', height: '220px' }}>
                                    {/* Render Line Chart using custom responsive SVG */}
                                    <VolumeTrendChart data={analytics.by_date} />
                                </div>
                            )}
                        </div>
                        {/* Chart 2: Template Usage Distribution */}
                        <div className="card">
                            <h2>Distribution by Template</h2>
                            <p className="tile-meta" style={{ marginBottom: '16px' }}>Popularity comparison among form templates</p>
                            {analytics.by_template.length === 0 ? (
                                <div className="empty-state" style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    No templates have been filled yet.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {analytics.by_template.map((t, idx) => {
                                        const maxVal = Math.max(...analytics.by_template.map(item => item.count)) || 1
                                        const pct = Math.round((t.count / maxVal) * 100)
                                        return (
                                            <div key={t.template_name} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 40px', gap: '10px', alignItems: 'center' }}>
                                                <div
                                                    style={{
                                                        fontWeight: 600,
                                                        fontSize: '0.85rem',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }}
                                                    title={t.template_name}
                                                >
                                                    {t.template_name}
                                                </div>
                                                <div style={{ background: '#e2e8f0', borderRadius: '999px', height: '12px', overflow: 'hidden' }}>
                                                    <div
                                                        style={{
                                                            background: idx === 0 ? 'var(--primary)' : 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
                                                            width: `${pct}%`,
                                                            height: '100%',
                                                            borderRadius: '999px',
                                                            transition: 'width 0.4s ease-out',
                                                        }}
                                                    ></div>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textAlign: 'right' }}>
                                                    {t.count}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Facts / Word Frequency Section */}
                    <div className="card">
                        <h2>Common Facts & Symptoms in Generated Reports</h2>
                        <p className="tile-meta" style={{ marginBottom: '16px' }}>
                            Extracted medical terms, issues, and clinical findings from descriptions that are frequently processed
                        </p>
                        {analytics.common_terms.length === 0 ? (
                            <div className="empty-state">
                                Write more descriptions in the "Fill Form" tab to generate keyword analytics.
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                    gap: '12px',
                                }}
                            >
                                {analytics.common_terms.map((term) => {
                                    const maxTermVal = Math.max(...analytics.common_terms.map(item => item.count)) || 1
                                    const pct = Math.round((term.count / maxTermVal) * 100)
                                    return (
                                        <div
                                            key={term.word}
                                            style={{
                                                background: '#f8fafc',
                                                border: '1px solid var(--panel-border)',
                                                borderRadius: '8px',
                                                padding: '10px 14px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '6px',
                                                position: 'relative',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', zIndex: 1 }}>
                                                <span style={{ fontWeight: 700, textTransform: 'capitalize', fontSize: '0.9rem' }}>
                                                    {term.word}
                                                </span>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>
                                                    {term.count}x
                                                </span>
                                            </div>
                                            {/* Sub progress background bar */}
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    bottom: 0,
                                                    left: 0,
                                                    height: '4px',
                                                    background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
                                                    width: `${pct}%`,
                                                    borderRadius: '2px',
                                                }}
                                            ></div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Input Text Viewer Modal */}
            {selectedInputText !== null && (
                <div className="modal-overlay" onClick={() => setSelectedInputText(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <button className="modal-close-btn" onClick={() => setSelectedInputText(null)}>
                            &times;
                        </button>
                        <div className="modal-body">
                            <h2 style={{ marginBottom: '14px' }}>Original Report Text</h2>
                            <p
                                style={{
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: '1.6',
                                    background: '#f8fafc',
                                    padding: '16px',
                                    borderRadius: '10px',
                                    border: '1px solid #e2e8f0',
                                    maxHeight: '360px',
                                    overflowY: 'auto',
                                }}
                            >
                                {selectedInputText || 'No description provided.'}
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setSelectedInputText(null)} style={{ marginLeft: 'auto' }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
// Volume Trend SVG Chart Component
function VolumeTrendChart({ data }: { data: { date: string; count: number }[] }) {
    const chartHeight = 160
    const chartWidth = 460
    const padding = { top: 10, right: 15, bottom: 25, left: 30 }
    const graphWidth = chartWidth - padding.left - padding.right
    const graphHeight = chartHeight - padding.top - padding.bottom
    const maxVal = Math.max(...data.map(d => d.count), 3)
    // Interpolate data points
    const points = data.map((d, index) => {
        const x = padding.left + (index / (data.length - 1 || 1)) * graphWidth
        const y = padding.top + graphHeight - (d.count / maxVal) * graphHeight
        return { x, y, date: d.date, count: d.count }
    })
    // Build path instructions
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

    const areaPath = points.length > 0
        ? `${linePath} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${points[0].x} ${padding.top + graphHeight} Z`
        : ''
    return (
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
            <defs>
                <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                </linearGradient>
            </defs>
            {/* Y Axis Gridlines */}
            {[0, 0.5, 1].map((ratio) => {
                const yVal = padding.top + graphHeight * ratio
                return (
                    <line
                        key={ratio}
                        x1={padding.left}
                        y1={yVal}
                        x2={chartWidth - padding.right}
                        y2={yVal}
                        stroke="#e2e8f0"
                        strokeDasharray="4 4"
                    />
                )
            })}
            {/* Area under the line */}
            {areaPath && <path d={areaPath} fill="url(#chartAreaGrad)" />}
            {/* The Line */}
            {linePath && <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" />}
            {/* Individual Dots */}
            {points.map((p, idx) => (
                <g key={idx}>
                    <circle
                        cx={p.x}
                        cy={p.y}
                        r="4.5"
                        fill="var(--primary)"
                        stroke="#fff"
                        strokeWidth="1.5"
                        style={{ cursor: 'pointer' }}
                    />
                    {/* Subtle tooltip overlay */}
                    <title>{`${p.date}: ${p.count} submissions`}</title>
                </g>
            ))}
            {/* X axis labels (Skip intermediate dates if too many to fit nicely) */}
            {points.map((p, idx) => {
                const showLabel = points.length <= 7 || idx === 0 || idx === points.length - 1 || idx === Math.floor(points.length / 2)
                if (!showLabel) return null

                // Parse date for cleaner display
                let dateLabel = p.date
                try {
                    const parts = p.date.split('-')
                    if (parts.length === 3) {
                        dateLabel = `${parts[1]}/${parts[2]}` // MM/DD
                    }
                } catch { }
                return (
                    <text
                        key={idx}
                        x={p.x}
                        y={chartHeight - 4}
                        textAnchor="middle"
                        fill="var(--muted)"
                        fontSize="10"
                        fontWeight="600"
                    >
                        {dateLabel}
                    </text>
                )
            })}
            {/* Y axis labels */}
            {[0, maxVal / 2, maxVal].map((val, idx) => {
                const ratio = idx / 2
                const yVal = padding.top + graphHeight - ratio * graphHeight
                return (
                    <text
                        key={idx}
                        x={padding.left - 8}
                        y={yVal + 3}
                        textAnchor="end"
                        fill="var(--muted)"
                        fontSize="10"
                        fontWeight="600"
                    >
                        {Math.round(val)}
                    </text>
                )
            })}
        </svg>
    )
}