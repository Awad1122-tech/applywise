import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const STATUS_CONFIG = {
  applied:    { label: 'Applied',    bg: '#EEF2FF', color: '#4338CA' },
  in_process: { label: 'In Process', bg: '#FEF9C3', color: '#854D0E' },
  rejected:   { label: 'Rejected',   bg: '#FEF2F2', color: '#991B1B' },
  selected:   { label: 'Selected',   bg: '#F0FDF4', color: '#166534' },
  withdrawn:  { label: 'Withdrawn',  bg: '#F3F4F6', color: '#374151' },
}

const CHART_COLORS = ['#534AB7','#EF9F27','#E24B4A','#1D9E75','#888780']

const QUICK_FILTERS = [
  { label: 'All time', value: 'all' },
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
  { label: 'Last 3 months', value: '3months' },
  { label: 'Last 6 months', value: '6months' },
]

function getQuickFilterDates(value) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (value === 'all') return { from: null, to: null }
  if (value === 'week') {
    const from = new Date(today)
    from.setDate(today.getDate() - today.getDay())
    return { from, to: now }
  }
  if (value === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from, to: now }
  }
  if (value === '3months') {
    const from = new Date(today)
    from.setMonth(today.getMonth() - 3)
    return { from, to: now }
  }
  if (value === '6months') {
    const from = new Date(today)
    from.setMonth(today.getMonth() - 6)
    return { from, to: now }
  }
  return { from: null, to: null }
}

export default function Dashboard() {
  const [applications, setApplications] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [user, setUser] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [quickFilter, setQuickFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editApp, setEditApp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [gmailImporting, setGmailImporting] = useState(false)
  const [gmailResult, setGmailResult] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!localStorage.getItem('token')) { navigate('/login'); return }
    fetchAll()
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail') === 'connected') {
      setGmailResult({ success: true, message: 'Gmail connected! Importing your jobs now...' })
      window.history.replaceState({}, '', '/')
      setTimeout(async () => {
        try {
          const res = await client.post('/gmail/import?max_results=100')
          setGmailResult({ success: true, message: res.data.message })
          fetchAll()
        } catch (err) {
          setGmailResult({ success: false, message: 'Import failed. Please try again.' })
        }
      }, 1000)
    } else if (params.get('gmail') === 'error') {
      setGmailResult({ success: false, message: 'Gmail connection failed. Please try again.' })
      window.history.replaceState({}, '', '/')
    }
  }, [])

  const fetchAll = async () => {
    try {
      const [apps, analyticsRes, userRes] = await Promise.all([
        client.get('/applications/'),
        client.get('/applications/analytics'),
        client.get('/auth/me'),
      ])
      setApplications(apps.data)
      setAnalytics(analyticsRes.data)
      setUser(userRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleGmailImport = async () => {
    setGmailImporting(true)
    setGmailResult(null)
    try {
      const authStatus = await client.get('/gmail/auth-status')
      if (!authStatus.data.authenticated) {
        const urlRes = await client.get('/gmail/oauth/url')
        window.location.href = urlRes.data.url
        return
      }
      const res = await client.post('/gmail/import?max_results=100')
      setGmailResult({ success: true, message: res.data.message })
      fetchAll()
    } catch (err) {
      setGmailResult({ success: false, message: 'Gmail import failed. Please try again.' })
    } finally {
      setGmailImporting(false)
      setTimeout(() => setGmailResult(null), 5000)
    }
  }

  const handleStatusUpdate = async (id, status) => {
    await client.patch(`/applications/${id}`, { status })
    fetchAll()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this application?')) return
    await client.delete(`/applications/${id}`)
    fetchAll()
  }

  const handleQuickFilter = (value) => {
    setQuickFilter(value)
    setDateFrom('')
    setDateTo('')
  }

  const handleCustomDate = (field, value) => {
    setQuickFilter('custom')
    if (field === 'from') setDateFrom(value)
    else setDateTo(value)
  }

  const handleExportCSV = () => {
    const headers = ['Company', 'Role', 'Status', 'Applied Date', 'Notes']
    const rows = filtered.map(app => [
      app.company,
      app.role,
      STATUS_CONFIG[app.status]?.label || app.status,
      new Date(app.applied_at).toLocaleDateString('en-GB'),
      (app.notes || '').replace(/,/g, ';').replace(/\n/g, ' ')
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `applications_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = applications.filter(app => {
    const s = search.toLowerCase()
    const matchSearch = !s || app.company.toLowerCase().includes(s) || app.role.toLowerCase().includes(s)
    const matchStatus = !statusFilter || app.status === statusFilter

    let matchDate = true
    const appDate = new Date(app.applied_at)

    if (quickFilter === 'custom') {
      if (dateFrom) matchDate = matchDate && appDate >= new Date(dateFrom)
      if (dateTo) matchDate = matchDate && appDate <= new Date(dateTo + 'T23:59:59')
    } else if (quickFilter !== 'all') {
      const { from, to } = getQuickFilterDates(quickFilter)
      if (from) matchDate = matchDate && appDate >= from
      if (to) matchDate = matchDate && appDate <= to
    }

    return matchSearch && matchStatus && matchDate
  })

  const chartData = analytics
    ? Object.entries(analytics.by_status).map(([k, v]) => ({
        name: STATUS_CONFIG[k]?.label || k,
        value: v,
        color: STATUS_CONFIG[k]?.color || '#888780'
      }))
    : []

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f7ff' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>💼</div>
        <p style={{ color: '#6b7280', fontFamily: 'Inter, system-ui, sans-serif' }}>Loading your applications...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#CBD5E8', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Navbar */}
      <div style={{
        background: 'white', borderBottom: '1px solid #ede9fe',
        padding: '0 2rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '60px',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', background: '#534AB7',
            borderRadius: '8px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '16px'
          }}>💼</div>
          <span style={{ fontWeight: '700', fontSize: '16px', color: '#1a1a2e' }}>ApplyWise</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>{user?.email}</span>
          <button
            onClick={() => { localStorage.removeItem('token'); navigate('/login') }}
            style={{
              fontSize: '13px', color: '#534AB7', background: 'none',
              border: '1.5px solid #534AB7', borderRadius: '8px',
              padding: '6px 14px', cursor: 'pointer', fontWeight: '500'
            }}
          >Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>

        {/* Page header */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a2e', margin: 0 }}>My Applications</h1>
            <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>Track and manage all your job applications in one place</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <button
              onClick={handleGmailImport}
              disabled={gmailImporting}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: gmailImporting ? '#f3f4f6' : 'white',
                color: gmailImporting ? '#9ca3af' : '#374151',
                border: '1.5px solid #e5e7eb', borderRadius: '10px',
                padding: '8px 16px', fontSize: '13px', fontWeight: '600',
                cursor: gmailImporting ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
              }}
            >
              <span>📧</span>
              {gmailImporting ? 'Importing...' : 'Import from Gmail'}
            </button>
            {gmailResult && (
              <div style={{
                fontSize: '12px', fontWeight: '500',
                color: gmailResult.success ? '#166534' : '#991B1B',
                background: gmailResult.success ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${gmailResult.success ? '#bbf7d0' : '#fecaca'}`,
                borderRadius: '8px', padding: '6px 12px', maxWidth: '280px', textAlign: 'right'
              }}>
                {gmailResult.success ? '✅' : '❌'} {gmailResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Stat cards */}
        {analytics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '1.5rem' }}>
            {[
              { label: 'Total applied', value: analytics.total_applications, color: '#534AB7', bg: '#EEF2FF' },
              { label: 'This week', value: analytics.this_week, color: '#0F6E56', bg: '#E1F5EE' },
              { label: 'This month', value: analytics.this_month, color: '#185FA5', bg: '#E6F1FB' },
              { label: 'Response rate', value: `${Math.round(analytics.response_rate * 100)}%`, color: '#854D0E', bg: '#FEF9C3' },
            ].map(stat => (
              <div key={stat.label} style={{
                background: 'white', borderRadius: '14px', padding: '1.25rem 1.5rem',
                border: '1px solid #ede9fe', boxShadow: '0 1px 3px rgba(83,74,183,0.06)'
              }}>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</p>
                <p style={{ fontSize: '28px', fontWeight: '700', color: stat.color, margin: '6px 0 0' }}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <div style={{
            background: 'white', borderRadius: '14px', padding: '1.5rem',
            border: '1px solid #ede9fe', marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(83,74,183,0.06)'
          }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a2e', marginBottom: '1rem' }}>Applications by status</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={36}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid #ede9fe', borderRadius: '10px', fontSize: '13px' }} cursor={{ fill: '#f3f0ff' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Date Filters */}
        <div style={{
          background: 'white', borderRadius: '14px', padding: '1rem 1.5rem',
          border: '1px solid #ede9fe', marginBottom: '1rem',
          boxShadow: '0 1px 3px rgba(83,74,183,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter by date:</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {QUICK_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => handleQuickFilter(f.value)}
                  style={{
                    padding: '5px 12px', borderRadius: '20px', fontSize: '12px',
                    fontWeight: '600', cursor: 'pointer', border: '1.5px solid',
                    borderColor: quickFilter === f.value ? '#534AB7' : '#e5e7eb',
                    background: quickFilter === f.value ? '#534AB7' : 'white',
                    color: quickFilter === f.value ? 'white' : '#6b7280',
                    transition: 'all 0.15s'
                  }}
                >{f.label}</button>
              ))}
            </div>
            <div style={{ width: '1px', height: '24px', background: '#e5e7eb' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                value={dateFrom}
                onChange={e => handleCustomDate('from', e.target.value)}
                style={{
                  padding: '5px 10px', border: '1.5px solid',
                  borderColor: quickFilter === 'custom' ? '#534AB7' : '#e5e7eb',
                  borderRadius: '8px', fontSize: '12px', outline: 'none',
                  color: '#1a1a2e', cursor: 'pointer'
                }}
              />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => handleCustomDate('to', e.target.value)}
                style={{
                  padding: '5px 10px', border: '1.5px solid',
                  borderColor: quickFilter === 'custom' ? '#534AB7' : '#e5e7eb',
                  borderRadius: '8px', fontSize: '12px', outline: 'none',
                  color: '#1a1a2e', cursor: 'pointer'
                }}
              />
              {quickFilter === 'custom' && (dateFrom || dateTo) && (
                <button
                  onClick={() => { setQuickFilter('all'); setDateFrom(''); setDateTo('') }}
                  style={{
                    padding: '5px 10px', borderRadius: '8px', fontSize: '12px',
                    fontWeight: '600', cursor: 'pointer', border: '1.5px solid #e5e7eb',
                    background: 'white', color: '#ef4444'
                  }}
                >Clear</button>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="🔍  Search company or role..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: '200px', padding: '9px 14px',
              border: '1.5px solid #e5e7eb', borderRadius: '10px',
              fontSize: '13px', outline: 'none', color: '#1a1a2e', background: 'white'
            }}
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '9px 14px', border: '1.5px solid #e5e7eb',
              borderRadius: '10px', fontSize: '13px', outline: 'none',
              color: '#1a1a2e', background: 'white', cursor: 'pointer'
            }}
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button
            onClick={handleExportCSV}
            style={{
              background: 'white', color: '#534AB7', border: '1.5px solid #534AB7',
              borderRadius: '10px', padding: '9px 18px', fontSize: '13px',
              fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >⬇ Export CSV</button>
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: '#534AB7', color: 'white', border: 'none',
              borderRadius: '10px', padding: '9px 18px', fontSize: '13px',
              fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >+ Add application</button>
        </div>

        {/* Results count */}
        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
          Showing <strong>{filtered.length}</strong> of <strong>{applications.length}</strong> applications
        </div>

        {/* Table */}
        <div style={{
          background: 'white', borderRadius: '14px',
          border: '1px solid #ede9fe', overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(83,74,183,0.06)'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#faf9ff', borderBottom: '1px solid #ede9fe' }}>
                {['Company', 'Role', 'Status', 'Applied', 'Actions'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '12px 16px',
                    color: '#6b7280', fontWeight: '600', fontSize: '12px',
                    textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
                    <p>No applications found for the selected filters.</p>
                  </td>
                </tr>
              ) : filtered.map((app, i) => (
                <tr key={app.id} style={{ borderTop: i > 0 ? '1px solid #f3f0ff' : 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#faf9ff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                  <td style={{ padding: '13px 16px', fontWeight: '600', color: '#1a1a2e' }}>{app.company}</td>
                  <td style={{ padding: '13px 16px', color: '#4b5563' }}>{app.role}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <select
                      value={app.status}
                      onChange={e => handleStatusUpdate(app.id, e.target.value)}
                      style={{
                        background: STATUS_CONFIG[app.status]?.bg || '#f3f4f6',
                        color: STATUS_CONFIG[app.status]?.color || '#374151',
                        border: 'none', borderRadius: '20px',
                        padding: '4px 10px', fontSize: '12px',
                        fontWeight: '600', cursor: 'pointer', outline: 'none'
                      }}
                    >
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '13px 16px', color: '#6b7280' }}>
                    {new Date(app.applied_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={() => setEditApp(app)}
                        style={{
                          background: 'none', border: 'none',
                          color: '#534AB7', fontSize: '12px',
                          cursor: 'pointer', fontWeight: '500'
                        }}
                      >Edit</button>
                      <button
                        onClick={() => handleDelete(app.id)}
                        style={{
                          background: 'none', border: 'none',
                          color: '#ef4444', fontSize: '12px',
                          cursor: 'pointer', fontWeight: '500'
                        }}
                      >Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <AddModal
          onClose={() => setShowModal(false)}
          onAdded={() => { setShowModal(false); fetchAll() }}
        />
      )}

      {editApp && (
        <EditModal
          app={editApp}
          onClose={() => setEditApp(null)}
          onSaved={() => { setEditApp(null); fetchAll() }}
        />
      )}
    </div>
  )
}

function AddModal({ onClose, onAdded }) {
  const [form, setForm] = useState({
    company: '', role: '', platform: 'other',
    status: 'applied', location: '', salary_range: '', notes: ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await client.post('/applications/', form)
      onAdded()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px',
    border: '1.5px solid #e5e7eb', borderRadius: '10px',
    fontSize: '13px', outline: 'none', color: '#1a1a2e',
    boxSizing: 'border-box', background: '#fafafa'
  }

  return (
    <ModalShell title="Add application" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Company *">
            <input style={inputStyle} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} required placeholder="e.g. Google" />
          </Field>
          <Field label="Role *">
            <input style={inputStyle} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} required placeholder="e.g. Data Analyst" />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Status">
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Location">
            <input style={inputStyle} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. London, UK" />
          </Field>
        </div>
        <Field label="Salary range">
          <input style={inputStyle} value={form.salary_range} onChange={e => setForm({ ...form, salary_range: e.target.value })} placeholder="e.g. £30k–£40k" />
        </Field>
        <Field label="Notes">
          <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any notes..." />
        </Field>
        <ModalButtons onCancel={onClose} loading={loading} submitLabel="Add application" />
      </form>
    </ModalShell>
  )
}

function EditModal({ app, onClose, onSaved }) {
  const [form, setForm] = useState({
    company: app.company || '',
    role: app.role || '',
    platform: app.platform || 'other',
    status: app.status || 'applied',
    location: app.location || '',
    salary_range: app.salary_range || '',
    notes: app.notes || '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await client.patch(`/applications/${app.id}`, form)
      onSaved()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px',
    border: '1.5px solid #e5e7eb', borderRadius: '10px',
    fontSize: '13px', outline: 'none', color: '#1a1a2e',
    boxSizing: 'border-box', background: '#fafafa'
  }

  return (
    <ModalShell title="Edit application" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Company *">
            <input style={inputStyle} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} required />
          </Field>
          <Field label="Role *">
            <input style={inputStyle} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} required />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Status">
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Location">
            <input style={inputStyle} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. London, UK" />
          </Field>
        </div>
        <Field label="Salary range">
          <input style={inputStyle} value={form.salary_range} onChange={e => setForm({ ...form, salary_range: e.target.value })} placeholder="e.g. £30k–£40k" />
        </Field>
        <Field label="Notes">
          <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <ModalButtons onCancel={onClose} loading={loading} submitLabel="Save changes" />
      </form>
    </ModalShell>
  )
}

function ModalShell({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: '1rem'
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', padding: '1.75rem',
        width: '100%', maxWidth: '480px',
        boxShadow: '0 20px 60px rgba(83,74,183,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#1a1a2e', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '5px' }}>{label}</label>
      {children}
    </div>
  )
}

function ModalButtons({ onCancel, loading, submitLabel }) {
  return (
    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
      <button type="button" onClick={onCancel} style={{
        flex: 1, padding: '10px', border: '1.5px solid #e5e7eb',
        borderRadius: '10px', fontSize: '13px', fontWeight: '500',
        cursor: 'pointer', background: 'white', color: '#374151'
      }}>Cancel</button>
      <button type="submit" disabled={loading} style={{
        flex: 1, padding: '10px', background: '#534AB7',
        color: 'white', border: 'none', borderRadius: '10px',
        fontSize: '13px', fontWeight: '600', cursor: 'pointer'
      }}>{loading ? 'Saving...' : submitLabel}</button>
    </div>
  )
}