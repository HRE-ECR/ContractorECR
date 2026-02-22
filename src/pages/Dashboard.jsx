import React from 'react'
import { supabase } from '../supabaseClient'

const NL = String.fromCharCode(10)

// -----------------------------
// Area mapping (DB values -> short display)
// -----------------------------
const AREA_SHORT_MAP = {
  'Maint-1': 'M1',
  'Maint-2': 'M2',
  'Insp-shed': 'Insp',
  'Rep-Shed': 'RShed',
  '1-Clean': '1CL',
  '2-Clean': '2CL',
  '3-Clean': '3CL',
  '4-Clean': '4CL',
  // Allow already-short values too (just in case)
  M1: 'M1',
  M2: 'M2',
  Insp: 'Insp',
  RShed: 'RShed',
  '1CL': '1CL',
  '2CL': '2CL',
  '3CL': '3CL',
  '4CL': '4CL',
}

const SHORT_ORDER = ['M1', 'M2', 'Insp', 'RShed', '1CL', '2CL', '3CL', '4CL']

const STANDARD_DB_AREAS = [
  'Maint-1',
  'Maint-2',
  'Insp-shed',
  'Rep-Shed',
  '1-Clean',
  '2-Clean',
  '3-Clean',
  '4-Clean',
]

function isOtherArea(a) {
  if (!a) return false
  const s = String(a).trim()
  if (!s) return false
  if (s.toLowerCase().startsWith('other:')) return true
  return (
    !STANDARD_DB_AREAS.includes(s) &&
    !Object.prototype.hasOwnProperty.call(AREA_SHORT_MAP, s)
  )
}

function extractOtherText(a) {
  if (!a) return ''
  const s = String(a).trim()
  if (!s) return ''
  const lower = s.toLowerCase()
  if (lower.startsWith('other:')) {
    const txt = s.slice(s.indexOf(':') + 1).trim()
    return txt
  }
  if (isOtherArea(s)) return s
  return ''
}

function shortStandardArea(a) {
  if (!a) return ''
  const s = String(a).trim()
  if (!s) return ''
  if (AREA_SHORT_MAP[s]) return AREA_SHORT_MAP[s]
  return ''
}

function areasTextForTables(areas) {
  const arr = Array.isArray(areas) ? areas : []
  const standards = new Set()
  const others = new Set()

  for (const a of arr) {
    const std = shortStandardArea(a)
    if (std) {
      standards.add(std)
      continue
    }
    const oth = extractOtherText(a)
    if (oth) others.add(oth)
  }

  const stdList = Array.from(standards)
  stdList.sort((x, y) => SHORT_ORDER.indexOf(x) - SHORT_ORDER.indexOf(y))

  const otherList = Array.from(others)
  otherList.sort((x, y) => x.localeCompare(y))

  return [...stdList, ...otherList].join(', ')
}

function hasAnyOther(areas) {
  const arr = Array.isArray(areas) ? areas : []
  for (const a of arr) {
    const oth = extractOtherText(a)
    if (oth) return true
  }
  return false
}

// -----------------------------
// Utilities
// -----------------------------
function formatDateDayMonthTime(value) {
  if (!value) return ''
  try {
    const d = new Date(value)
    const date = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    return `${date} ${time}`
  } catch {
    return String(value)
  }
}

function formatStaffEmail(email) {
  if (!email) return ''
  const e = String(email).trim()
  if (!e) return ''

  const local = e.split('@')[0] || ''
  if (!local) return ''

  const parts = local.split('.').filter(Boolean)
  const firstPart = parts[0] || local
  const lastPart = parts.length > 1 ? parts[parts.length - 1] : firstPart

  const initial = (firstPart[0] || '').toUpperCase()
  const surname = (lastPart[0] || '').toUpperCase() + (lastPart.slice(1) || '').toLowerCase()

  if (!initial || !surname) return local
  return `${initial}.${surname}`
}

function csvEscape(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes('"') || s.includes(',') || s.includes(NL)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function downloadCsv(filename, rows) {
  if (!rows || rows.length === 0) return
  const header = Object.keys(rows[0]).join(',')
  const lines = rows.map((r) => Object.values(r).map(csvEscape).join(','))
  const csv = [header, ...lines].join(NL)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// -----------------------------
// JWT role helper (NO profiles query -> avoids Zscaler)
// -----------------------------
function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const json = atob(b64)
    return JSON.parse(json)
  } catch {
    return null
  }
}

async function getAppRoleFromAuth() {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    const payload = decodeJwtPayload(token)
    const role = payload?.app_metadata?.app_role || payload?.user_role || null
    if (role) return role
  } catch {
    // ignore
  }

  try {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
    )
    if (!key) return null
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const accessToken = parsed?.currentSession?.access_token || parsed?.access_token || null
    const payload = decodeJwtPayload(accessToken)
    const role = payload?.app_metadata?.app_role || payload?.user_role || null
    if (role) return role
    return parsed?.currentSession?.user?.app_metadata?.app_role || null
  } catch {
    return null
  }
}

// -----------------------------
// Section Header
// -----------------------------
function SectionHeader({ title, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-900 text-white',
    blue: 'bg-[#0b3a5a] text-white',
    green: 'bg-emerald-700 text-white',
  }
  const cls = tones[tone] || tones.slate
  return (
    <div className={`mt-5 mb-2 ${cls} rounded-md px-3 py-1 flex items-center justify-between`}>
      <div className="text-sm font-semibold tracking-wide">{title}</div>
    </div>
  )
}

// -----------------------------
// Badge (timer pill) - tuned for light + dark
// -----------------------------
function TimerBadge({ tone = 'green', text, darkMode }) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap'

  const greenLight = 'bg-emerald-700 text-white border-emerald-800'
  const greenDark = 'bg-emerald-400/20 text-emerald-50 border-emerald-300'

  const redLight = 'bg-rose-700 text-white border-rose-800'
  const redDark = 'bg-rose-400/20 text-rose-50 border-rose-300'

  const cls =
    tone === 'red'
      ? `${base} ${darkMode ? redDark : redLight}`
      : `${base} ${darkMode ? greenDark : greenLight}`

  return <span className={cls}>⏱️ {text}</span>
}

// -----------------------------
// Summary (Counters)
// -----------------------------
function Summary({ items }) {
  const onSite = items.filter((i) => i.status !== 'signed_out' && !i.signed_out_at)

  const counts = {}
  SHORT_ORDER.forEach((k) => {
    counts[k] = 0
  })

  let otherCount = 0

  onSite.forEach((i) => {
    const areas = Array.isArray(i.areas) ? i.areas : []
    areas.forEach((a) => {
      const s = shortStandardArea(a)
      if (s && Object.prototype.hasOwnProperty.call(counts, s)) counts[s] += 1
    })
    if (hasAnyOther(areas)) otherCount += 1
  })

  const tileClass =
    'border border-[#0b3a5a] bg-[#0b3a5a] text-white rounded-lg px-3 py-2 shadow-sm flex items-center justify-between gap-3 min-w-[86px]'

  const tile = (label, value) => (
    <div className={tileClass} key={label}>
      <div className="text-xs font-semibold tracking-wide opacity-90">{label}</div>
      <div className="text-lg font-bold leading-none">{value}</div>
    </div>
  )

  const tiles = []
  tiles.push(tile('Total 👷‍♂️', onSite.length))
  SHORT_ORDER.forEach((k) => {
    const v = counts[k] || 0
    if (v > 0) tiles.push(tile(k, v))
  })
  if (otherCount > 0) tiles.push(tile('Other', otherCount))

  return (
    <div className="mb-3">
      <div className="flex flex-wrap gap-2">{tiles}</div>
    </div>
  )
}

// -----------------------------
// Awaiting Row (MORE VIBRANT GREEN - light + dark) + TIMER BADGE
// -----------------------------
function AwaitingRow({ item, onConfirm, darkMode }) {
  const [fob, setFob] = React.useState('')

  // Stronger green for both modes
  const rowBg = darkMode ? 'bg-emerald-500/25' : 'bg-emerald-200'
  const accent = darkMode ? 'border-l-4 border-emerald-400' : 'border-l-4 border-emerald-700'

  const textMain = darkMode ? 'text-emerald-50' : 'text-emerald-950'
  const textSoft = darkMode ? 'text-emerald-50/90' : 'text-emerald-950/90'

  const inputCls = darkMode
    ? 'border rounded px-2 py-1 w-28 bg-slate-900 text-slate-100 border-slate-600'
    : 'border rounded px-2 py-1 w-28 bg-white'

  return (
    <tr className={rowBg}>
      <td className={`px-2 py-2 whitespace-nowrap font-semibold ${textMain} ${accent}`}>
        <div className="flex items-center gap-2">
          <TimerBadge tone="green" text="Awaiting sign-in" darkMode={darkMode} />
          <span>
            {item.first_name} {item.surname}
          </span>
        </div>
      </td>
      <td className={`px-2 py-2 ${textSoft}`}>{item.company}</td>
      <td className={`px-2 py-2 whitespace-nowrap ${textSoft}`}>{item.phone}</td>
      <td className={`px-2 py-2 ${textSoft}`}>{areasTextForTables(item.areas)}</td>
      <td className={`px-2 py-2 whitespace-nowrap ${textSoft}`}>
        {formatDateDayMonthTime(item.signed_in_at)}
      </td>
      <td className="px-2 py-2">
        <input
          value={fob}
          onChange={(e) => setFob(e.target.value)}
          className={inputCls}
          placeholder="(optional)"
        />
      </td>
      <td className="px-2 py-2 whitespace-nowrap">
        <button
          onClick={() => onConfirm(item.id, fob)}
          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Confirm sign-in
        </button>
      </td>
    </tr>
  )
}

// -----------------------------
// Dashboard
// -----------------------------
export default function Dashboard() {
  const [items, setItems] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [appRole, setAppRole] = React.useState(null)
  const [error, setError] = React.useState('')
  const [signedOutExpanded, setSignedOutExpanded] = React.useState(false)

  // Dark mode (works without Tailwind dark config)
  const [darkMode, setDarkMode] = React.useState(() => {
    try {
      return localStorage.getItem('theme') === 'dark'
    } catch {
      return false
    }
  })

  React.useEffect(() => {
    try {
      localStorage.setItem('theme', darkMode ? 'dark' : 'light')
    } catch {
      // ignore
    }
  }, [darkMode])

  function toggleDarkMode() {
    setDarkMode((v) => !v)
  }

  function hasFobIssued(item) {
    const v = (item?.fob_number || '').toString().trim()
    return v.length > 0
  }

  function canConfirmSignOut(item) {
    if (!item) return false
    const fobIssued = hasFobIssued(item)

    if (isAdmin) {
      if (fobIssued) return !!item.fob_returned
      return !!item.signout_requested
    }

    if (!item.signout_requested) return false
    if (!fobIssued) return true
    return !!item.fob_returned
  }

  function signOutDisabledReason(item) {
    if (!item) return 'Unavailable'
    const fobIssued = hasFobIssued(item)
    if (!isAdmin && !item.signout_requested) return 'Sign-out must be requested first'
    if (isAdmin && !fobIssued && !item.signout_requested) return 'Sign-out must be requested first'
    if (fobIssued && !item.fob_returned) return 'Fob must be returned first'
    return ''
  }

  const loadRef = React.useRef(null)

  async function load() {
    setError('')

    const role = await getAppRoleFromAuth()
    setAppRole(role)
    setIsAdmin(role === 'admin')

    // Display role cannot access dashboard
    if (role === 'Display') {
      setItems([])
      return
    }

    const { data, error: listErr } = await supabase
      .from('contractors')
      .select('*')
      .order('signed_in_at', { ascending: false })
      .limit(500)

    if (listErr) setError(listErr.message)
    setItems(data || [])
  }

  React.useEffect(() => {
    loadRef.current = load
  })

  React.useEffect(() => {
    ;(async () => {
      setLoading(true)
      await load()
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (appRole === 'Display') return

    let debounceTimer = null
    const channel = supabase
      .channel('contractors-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contractors' }, () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          if (loadRef.current) loadRef.current()
        }, 400)
      })
      .subscribe()

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [appRole])

  async function handleRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  function normalizeFob(v) {
    return (v || '').toString().trim().toLowerCase()
  }

  async function confirmSignIn(itemId, fob) {
    const raw = (fob || '').toString().trim()
    let finalFob = raw

    // If fob was entered, ensure it isn't already assigned to someone currently on site
    if (finalFob) {
      const entered = normalizeFob(finalFob)
      const inUse = items.some((i) => {
        const isActive = i.status === 'confirmed' && !i.signed_out_at
        if (!isActive) return false
        const existing = normalizeFob(i.fob_number)
        return existing && existing === entered
      })

      if (inUse) {
        alert('Fob # already in use, please select another')
        return
      }
    }

    if (!finalFob) {
      const ok = confirm('No fob number entered. Confirm that no fob is required or being issued?')
      if (!ok) return
      finalFob = ''
    }

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id || null
    const email = userData?.user?.email || null

    const updatePayload = {
      status: 'confirmed',
      sign_in_confirmed_at: new Date().toISOString(),
      sign_in_confirmed_by: uid,
      sign_in_confirmed_by_email: email,
      fob_number: finalFob ? finalFob : null,
    }

    const { error } = await supabase.from('contractors').update(updatePayload).eq('id', itemId)
    if (error) alert(error.message)
    else load()
  }

  async function confirmSignOut(item) {
    if (!canConfirmSignOut(item)) {
      const msg = signOutDisabledReason(item) || 'Not allowed'
      alert(`Cannot confirm sign-out: ${msg}`)
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id || null
    const email = userData?.user?.email || null

    const { error } = await supabase
      .from('contractors')
      .update({
        status: 'signed_out',
        signed_out_at: new Date().toISOString(),
        signed_out_by: uid,
        signed_out_by_email: email,
      })
      .eq('id', item.id)

    if (error) alert(error.message)
    else load()
  }

  async function setFobReturned(itemId, value) {
    const item = items.find((x) => x.id === itemId)
    if (item && !hasFobIssued(item)) return

    const prevItems = items
    setItems((curr) => curr.map((i) => (i.id === itemId ? { ...i, fob_returned: value } : i)))

    const { error } = await supabase
      .from('contractors')
      .update({ fob_returned: value })
      .eq('id', itemId)

    if (error) {
      setItems(prevItems)
      alert(error.message)
    }
  }

  async function remove(itemId) {
    if (!isAdmin) return
    if (!confirm('Delete this record? This cannot be undone.')) return
    const { error } = await supabase.from('contractors').delete().eq('id', itemId)
    if (error) alert(error.message)
    else load()
  }

  function exportAllTables() {
    const awaiting = items.filter((i) => i.status === 'pending' && !i.signed_out_at)
    const onSite = items.filter((i) => i.status === 'confirmed' && !i.signed_out_at)

    const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000
    const signedOut = items
      .filter((i) => i.signed_out_at)
      .filter((i) => new Date(i.signed_out_at).getTime() >= fourDaysAgo)

    const toRow = (i, tableName) => ({
      table: tableName,
      id: i.id,
      first_name: i.first_name,
      surname: i.surname,
      company: i.company,
      phone: i.phone,
      areas: areasTextForTables(i.areas),
      status: i.status,
      fob_number: i.fob_number || '',
      fob_returned: hasFobIssued(i) ? (i.fob_returned ? 'true' : 'false') : 'N/A',
      signout_requested: i.signout_requested ? 'true' : 'false',
      signed_in_at: i.signed_in_at || '',
      sign_in_confirmed_at: i.sign_in_confirmed_at || '',
      signed_out_at: i.signed_out_at || '',
      sign_in_confirmed_by: formatStaffEmail(i.sign_in_confirmed_by_email || ''),
      signed_out_by: formatStaffEmail(i.signed_out_by_email || ''),
    })

    const rows = [
      ...awaiting.map((i) => toRow(i, 'awaiting_confirmation')),
      ...onSite.map((i) => toRow(i, 'on_site')),
      ...signedOut.map((i) => toRow(i, 'signed_out')),
    ]

    if (rows.length === 0) return alert('No data to export')
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    downloadCsv(`contractors_export_${stamp}.csv`, rows)
  }

  // -----------------------------
  // Render theme classes (no Tailwind dark: dependency)
  // -----------------------------
  const pageBg = darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
  const cardBorder = darkMode ? 'border-slate-700' : 'border-slate-200'
  const theadBg = darkMode ? 'bg-slate-800 text-slate-100' : 'bg-slate-50 text-slate-700'
  const btnLight = darkMode
    ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
    : 'bg-slate-200 hover:bg-slate-300'
  const mutedText = darkMode ? 'text-slate-300' : 'text-slate-600'

  if (loading) return <div className="p-4">Loading...</div>

  if (appRole === 'Display') {
    return (
      <div className={`p-6 max-w-xl mx-auto ${pageBg} min-h-screen`}>
        <div
          className={`border ${cardBorder} rounded-lg p-4 ${
            darkMode ? 'bg-slate-900' : 'bg-white'
          } shadow-sm`}
        >
          <h2 className="text-xl font-bold mb-2">Access denied</h2>
          <p className={darkMode ? 'text-slate-200' : 'text-slate-700'}>
            Display accounts cannot access the Dashboard. Please use the Screen Display page.
          </p>
        </div>
      </div>
    )
  }

  const awaiting = items.filter((i) => i.status === 'pending' && !i.signed_out_at)

  // Signed-in list, but with sign-out requested moved to top
  const onSiteRaw = items.filter((i) => i.status === 'confirmed' && !i.signed_out_at)
  const onSite = [...onSiteRaw].sort((a, b) => {
    const aReq = a.signout_requested ? 1 : 0
    const bReq = b.signout_requested ? 1 : 0
    if (bReq !== aReq) return bReq - aReq // requested first
    const at = a.signed_in_at ? new Date(a.signed_in_at).getTime() : 0
    const bt = b.signed_in_at ? new Date(b.signed_in_at).getTime() : 0
    return bt - at
  })

  const now = Date.now()
  const cutoffMs = signedOutExpanded ? 4 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000
  const cutoff = now - cutoffMs

  const signedOutAll = items
    .filter((i) => i.signed_out_at)
    .filter((i) => new Date(i.signed_out_at).getTime() >= cutoff)
    .sort((a, b) => new Date(b.signed_out_at).getTime() - new Date(a.signed_out_at).getTime())

  const signedOut = signedOutAll.slice(0, signedOutExpanded ? 30 : 5)

  const tableWrap = 'overflow-auto'
  const tableClass = `min-w-full border ${cardBorder} rounded`
  const thClass = 'text-left px-2 py-2'

  return (
    <div className={`p-4 ${pageBg} min-h-screen`}>
      <h2 className="text-xl font-bold mb-2">Contractor/Visitor details</h2>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <button
          onClick={handleRefresh}
          className="px-3 py-1 text-sm bg-slate-900 text-white rounded hover:bg-slate-800"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>

        <button onClick={exportAllTables} className={`px-3 py-1 text-sm rounded ${btnLight}`}>
          Export all tables (CSV)
        </button>

        <button
          onClick={toggleDarkMode}
          className="ml-auto px-3 py-1 text-sm bg-slate-900 text-white rounded hover:bg-slate-800"
          title="Toggle dark mode"
        >
          {darkMode ? '☀️ Light mode' : '🌙 Dark mode'}
        </button>
      </div>

      {error && (
        <div
          className={`mb-3 text-sm rounded p-2 border ${
            darkMode
              ? 'text-red-200 bg-red-950/40 border-red-900'
              : 'text-red-700 bg-red-50 border-red-200'
          }`}
        >
          {error}
        </div>
      )}

      <Summary items={items} />

      <SectionHeader title="Awaiting confirmation" tone="green" />
      <div className={tableWrap}>
        <table className={tableClass}>
          <thead className={theadBg}>
            <tr>
              <th className={thClass}>Name</th>
              <th className={thClass}>Company</th>
              <th className={thClass}>Phone</th>
              <th className={thClass}>Areas</th>
              <th className={thClass}>Signed in</th>
              <th className={thClass}>Fob #</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {awaiting.length === 0 && (
              <tr>
                <td className={`px-2 py-3 ${mutedText}`} colSpan={7}>
                  None
                </td>
              </tr>
            )}
            {awaiting.map((i) => (
              <AwaitingRow key={i.id} item={i} onConfirm={confirmSignIn} darkMode={darkMode} />
            ))}
          </tbody>
        </table>
      </div>

      <SectionHeader title="Signed in contractors/visitors" tone="blue" />
      <div className={tableWrap}>
        <table className={tableClass}>
          <thead className={theadBg}>
            <tr>
              <th className={thClass}>Name</th>
              <th className={thClass}>Company</th>
              <th className={thClass}>Phone</th>
              <th className={thClass}>Areas</th>
              <th className={thClass}>Signed in</th>
              <th className={thClass}>Fob #</th>
              <th className={thClass}>Signed in by</th>
              <th className={thClass}>Fob returned</th>
              <th className={thClass}>Sign-out requested</th>
              <th className={thClass}></th>
              {isAdmin && <th className={thClass}></th>}
            </tr>
          </thead>
          <tbody>
            {onSite.length === 0 && (
              <tr>
                <td className={`px-2 py-3 ${mutedText}`} colSpan={isAdmin ? 11 : 10}>
                  None
                </td>
              </tr>
            )}

            {onSite.map((i) => {
              const canSignOut = canConfirmSignOut(i)
              const reason = signOutDisabledReason(i)
              const fobIssued = hasFobIssued(i)

              // MORE VIBRANT RED for sign-out requested (light + dark)
              const rowTone = i.signout_requested
                ? darkMode
                  ? 'bg-rose-500/25'
                  : 'bg-rose-200'
                : ''

              const accent = i.signout_requested
                ? darkMode
                  ? 'border-l-4 border-rose-400'
                  : 'border-l-4 border-rose-700'
                : ''

              return (
                <tr key={i.id} className={rowTone}>
                  <td className={`px-2 py-2 whitespace-nowrap font-semibold ${accent}`}>
                    <div className="flex items-center gap-2">
                      {i.signout_requested && (
                        <TimerBadge tone="red" text="Awaiting sign-out" darkMode={darkMode} />
                      )}
                      <span>
                        {i.first_name} {i.surname}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2">{i.company}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{i.phone}</td>
                  <td className="px-2 py-2">{areasTextForTables(i.areas)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {formatDateDayMonthTime(i.signed_in_at)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{i.fob_number || '-'}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {formatStaffEmail(i.sign_in_confirmed_by_email) || '-'}
                  </td>

                  {/* Fob returned: show N/A if no fob issued */}
                  <td className="px-2 py-2 whitespace-nowrap">
                    {!fobIssued ? (
                      <span className={mutedText}>N/A</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={!!i.fob_returned}
                        onChange={(e) => setFobReturned(i.id, e.target.checked)}
                        title="Tick when fob returned"
                      />
                    )}
                  </td>

                  <td className="px-2 py-2 whitespace-nowrap">{i.signout_requested ? 'Yes' : 'No'}</td>

                  <td className="px-2 py-2 whitespace-nowrap">
                    <button
                      onClick={() => confirmSignOut(i)}
                      disabled={!canSignOut}
                      title={!canSignOut ? reason : 'Confirm sign-out'}
                      className={`px-3 py-1 rounded whitespace-nowrap text-sm ${
                        canSignOut
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : `${btnLight} opacity-70 cursor-not-allowed`
                      }`}
                      style={{ fontSize: '0.80rem' }}
                    >
                      Confirm sign-out
                    </button>
                  </td>

                  {isAdmin && (
                    <td className="px-2 py-2 whitespace-nowrap">
                      <button
                        onClick={() => remove(i.id)}
                        className="px-2 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 mb-2 flex items-center justify-between gap-2">
        <div className="bg-slate-900 text-white rounded-md px-3 py-1 text-sm font-semibold tracking-wide">
          Signed out (last {signedOutExpanded ? 30 : 5}
          {signedOutExpanded ? ', last 4 days' : ', last 12 hours'})
        </div>

        {!signedOutExpanded && signedOutAll.length > 5 && (
          <button
            onClick={() => setSignedOutExpanded(true)}
            className="px-3 py-1 text-sm bg-slate-900 text-white rounded hover:bg-slate-800"
          >
            Show more
          </button>
        )}

        {signedOutExpanded && (
          <button
            onClick={() => setSignedOutExpanded(false)}
            className={`px-3 py-1 text-sm rounded ${btnLight}`}
          >
            Show less
          </button>
        )}
      </div>

      <div className="overflow-auto mt-2">
        <table className={tableClass}>
          <thead className={theadBg}>
            <tr>
              <th className={thClass}>Name</th>
              <th className={thClass}>Company</th>
              <th className={thClass}>Phone</th>
              <th className={thClass}>Areas</th>
              <th className={thClass}>Fob #</th>
              <th className={thClass}>Fob returned</th>
              <th className={thClass}>Signed in</th>
              <th className={thClass}>Signed out</th>
              <th className={thClass}>Signed in by</th>
              <th className={thClass}>Signed out by</th>
            </tr>
          </thead>
          <tbody>
            {signedOut.length === 0 && (
              <tr>
                <td className={`px-2 py-3 ${mutedText}`} colSpan={10}>
                  None
                </td>
              </tr>
            )}

            {signedOut.map((i) => {
              const fobIssued = hasFobIssued(i)
              return (
                <tr key={i.id}>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {i.first_name} {i.surname}
                  </td>
                  <td className="px-2 py-2">{i.company}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{i.phone}</td>
                  <td className="px-2 py-2">{areasTextForTables(i.areas)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{i.fob_number || '-'}</td>

                  {/* Signed-out table: show N/A if no fob issued */}
                  <td className="px-2 py-2 whitespace-nowrap">
                    {!fobIssued ? <span className={mutedText}>N/A</span> : i.fob_returned ? 'Yes' : 'No'}
                  </td>

                  <td className="px-2 py-2 whitespace-nowrap">
                    {formatDateDayMonthTime(i.signed_in_at)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {formatDateDayMonthTime(i.signed_out_at)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {formatStaffEmail(i.sign_in_confirmed_by_email) || '-'}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {formatStaffEmail(i.signed_out_by_email) || '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className={`mt-3 text-xs ${mutedText}`}>
        Signed-out records are kept for up to 30 days and then automatically removed.
      </div>
    </div>
  )
}
