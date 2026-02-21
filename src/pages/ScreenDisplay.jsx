import React from 'react'
import { supabase } from '../supabaseClient'

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
}

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

const SHORT_ORDER = ['M1', 'M2', 'Insp', 'RShed', '1CL', '2CL', '3CL', '4CL']

function isOtherArea(a) {
  if (!a) return false
  const s = String(a).trim()
  if (!s) return false
  if (s.toLowerCase().startsWith('other:')) return true
  return !STANDARD_DB_AREAS.includes(s) && !Object.prototype.hasOwnProperty.call(AREA_SHORT_MAP, s)
}

function extractOtherText(a) {
  if (!a) return ''
  const s = String(a).trim()
  if (!s) return ''
  const lower = s.toLowerCase()
  if (lower.startsWith('other:')) {
    return s.slice(s.indexOf(':') + 1).trim()
  }
  if (isOtherArea(s)) return s
  return ''
}

function shortStandardArea(a) {
  if (!a) return ''
  const s = String(a).trim()
  if (!s) return ''
  return AREA_SHORT_MAP[s] || ''
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
    if (extractOtherText(a)) return true
  }
  return false
}

// -----------------------------
// Date/time formatting (day+month, no year; time no seconds)
// -----------------------------
function formatDayMonthTime(ts) {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    const date = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    return `${date} ${time}`
  } catch {
    return String(ts)
  }
}

// -----------------------------
// Signed-in/out by formatting: "Jason.Edwards@..." -> "J.Edwards"
// -----------------------------
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

// -----------------------------
// Solid section header (minimal height)
// -----------------------------
function SectionHeader({ title, count, tone = 'slate', darkMode }) {
  const tones = {
    slate: darkMode ? 'bg-slate-900 text-white' : 'bg-slate-900 text-white',
    blue: darkMode ? 'bg-[#0b3a5a] text-white' : 'bg-[#0b3a5a] text-white',
    green: darkMode ? 'bg-emerald-700 text-white' : 'bg-emerald-700 text-white',
  }
  const cls = tones[tone] || tones.slate

  return (
    <div className={`px-4 py-2 font-semibold flex items-center justify-between ${cls}`}>
      <div className="text-sm tracking-wide">
        {title}
        {typeof count === 'number' ? ` (${count})` : ''}
      </div>
    </div>
  )
}

function isOverflowing(el) {
  if (!el) return false
  return el.scrollHeight > el.clientHeight + 4
}

export default function ScreenDisplay() {
  const [items, setItems] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [lastUpdated, setLastUpdated] = React.useState(null)
  const [error, setError] = React.useState('')

  // Dark mode state (persisted)
  const [darkMode, setDarkMode] = React.useState(false)

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = React.useState(false)

  // ✅ TEMP: Auto-scroll toggle button (remove later)
  const [autoScrollEnabled, setAutoScrollEnabled] = React.useState(false)

  // Debug/status (helps confirm target + movement)
  const [scrollStatus, setScrollStatus] = React.useState('')

  // Scroll container ref
  const scrollRef = React.useRef(null)

  // -----------------------------
  // Dark mode persistence
  // -----------------------------
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('screenDisplayDarkMode')
      if (saved === 'true' || saved === 'false') {
        setDarkMode(saved === 'true')
      } else if (window?.matchMedia) {
        setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
      }
    } catch {
      // ignore
    }
  }, [])

  React.useEffect(() => {
    try {
      localStorage.setItem('screenDisplayDarkMode', String(darkMode))
    } catch {
      // ignore
    }
  }, [darkMode])

  // -----------------------------
  // Track fullscreen changes
  // -----------------------------
  React.useEffect(() => {
    const update = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement
      setIsFullscreen(!!fsEl)
    }
    update()
    document.addEventListener('fullscreenchange', update)
    document.addEventListener('webkitfullscreenchange', update)
    return () => {
      document.removeEventListener('fullscreenchange', update)
      document.removeEventListener('webkitfullscreenchange', update)
    }
  }, [])

  async function toggleFullscreen() {
    try {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement
      if (fsEl) {
        if (document.exitFullscreen) await document.exitFullscreen()
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen()
        return
      }
      const target = scrollRef.current || document.documentElement
      if (target.requestFullscreen) await target.requestFullscreen()
      else if (target.webkitRequestFullscreen) await target.webkitRequestFullscreen()
    } catch {
      setError('Fullscreen could not be enabled in this browser/environment.')
    }
  }

  // -----------------------------
  // Data loading
  // -----------------------------
  const loadRef = React.useRef(null)

  async function load() {
    setError('')
    const { data, error } = await supabase
      .from('contractors')
      .select('*')
      .order('signed_in_at', { ascending: false })
      .limit(500)

    if (error) setError(error.message)
    setItems(data || [])
    setLastUpdated(Date.now())
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

  // Realtime refresh
  React.useEffect(() => {
    let debounceTimer = null
    const channel = supabase
      .channel('screen-contractors-db-changes')
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
  }, [])

  // -----------------------------
  // Auto scroll up/down (button-only control)
  // - No input detection at all
  // - Runs only when autoScrollEnabled = true AND overflow is true
  // - Uses scrollTo() (more forceful than scrollTop +=)
  // - Re-inits on fullscreen changes
  // -----------------------------
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    if (!autoScrollEnabled) {
      setScrollStatus('')
      return
    }

    const prefersReduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setScrollStatus('Auto-scroll disabled (reduced motion)')
      return
    }

    let rafId = null
    let direction = 1 // 1 down, -1 up
    let lastT = performance.now()

    const speedPxPerSec = 14
    const edgePauseMs = 1400
    let pauseUntil = 0

    const maxScrollTop = () => Math.max(0, el.scrollHeight - el.clientHeight)
    const atBottom = () => el.scrollTop >= maxScrollTop() - 1
    const atTop = () => el.scrollTop <= 1

    const updateStatus = () => {
      const overflow = isOverflowing(el)
      const max = maxScrollTop()
      setScrollStatus(
        `Auto-scroll ON • target: section • overflow: ${overflow ? 'yes' : 'no'} • pos: ${Math.round(el.scrollTop)}/${Math.round(max)}`
      )
    }

    // Keep status fresh
    updateStatus()

    // Watch size changes (fullscreen/layout) so maxScrollTop updates correctly
    let ro = null
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => {
        updateStatus()
      })
      ro.observe(el)
    }

    const step = (t) => {
      const dt = Math.min((t - lastT) / 1000, 0.06)
      lastT = t

      // Only scroll if overflow
      if (!isOverflowing(el)) {
        updateStatus()
        rafId = requestAnimationFrame(step)
        return
      }

      if (t < pauseUntil) {
        rafId = requestAnimationFrame(step)
        return
      }

      const delta = direction * speedPxPerSec * dt
      const next = Math.min(Math.max(el.scrollTop + delta, 0), maxScrollTop())

      // Force scroll position (some environments ignore incremental scrollTop updates)
      el.scrollTo({ top: next, behavior: 'auto' })

      // Update status occasionally (not every frame heavy)
      if (Math.random() < 0.08) updateStatus()

      if (direction > 0 && atBottom()) {
        direction = -1
        pauseUntil = t + edgePauseMs
      } else if (direction < 0 && atTop()) {
        direction = 1
        pauseUntil = t + edgePauseMs
      }

      rafId = requestAnimationFrame(step)
    }

    rafId = requestAnimationFrame(step)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (ro) ro.disconnect()
    }
  }, [autoScrollEnabled, items.length, darkMode, isFullscreen])

  // Data buckets
  const awaiting = items.filter((i) => i.status === 'pending' && !i.signed_out_at)
  const onSite = items.filter((i) => i.status === 'confirmed' && !i.signed_out_at)

  // Totals
  const counts = {}
  STANDARD_DB_AREAS.forEach((a) => {
    counts[a] = 0
  })
  let otherCount = 0

  onSite.forEach((i) => {
    const areas = Array.isArray(i.areas) ? i.areas : []
    let hasOther = false
    areas.forEach((a) => {
      if (STANDARD_DB_AREAS.includes(a)) counts[a] += 1
      else if (isOtherArea(a)) hasOther = true
    })
    if (hasOther || hasAnyOther(areas)) otherCount += 1
  })

  function counterLabel(dbAreaName) {
    return AREA_SHORT_MAP[dbAreaName] || dbAreaName
  }

  function CounterTile({ label, value }) {
    const tileCls =
      'px-3 py-2 rounded-lg border shadow-sm flex items-center justify-between border-[#0b3a5a] bg-[#0b3a5a] text-white'
    return (
      <div className={tileCls}>
        <div className="text-[11px] font-semibold truncate opacity-90">{label}</div>
        <div className="text-lg font-bold tabular-nums">{value}</div>
      </div>
    )
  }

  const pageBg = darkMode ? 'bg-slate-950 text-slate-100' : 'bg-transparent text-slate-900'
  const mutedText = darkMode ? 'text-slate-300' : 'text-slate-600'
  const cardBase = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
  const theadBase = darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-500'

  // Vibrant highlights
  const awaitingRowBg = darkMode ? 'bg-emerald-900/45' : 'bg-emerald-100/80'
  const awaitingTextMain = darkMode ? 'text-emerald-100' : 'text-emerald-950'
  const awaitingTextSub = darkMode ? 'text-emerald-100/90' : 'text-emerald-950/90'

  const signoutRowBg = darkMode ? 'bg-rose-900/40' : 'bg-rose-100/80'
  const signoutTextMain = darkMode ? 'text-rose-100' : 'text-rose-950'
  const signoutTextSub = darkMode ? 'text-rose-100/90' : 'text-rose-950/90'

  if (loading) return <div className="p-6 text-xl">Loading screen display…</div>

  const areaCounterTiles = STANDARD_DB_AREAS
    .map((a) => ({ db: a, label: counterLabel(a), value: counts[a] || 0 }))
    .filter((x) => x.value > 0)
    .sort((x, y) => SHORT_ORDER.indexOf(x.label) - SHORT_ORDER.indexOf(y.label))

  return (
    <section
      ref={scrollRef}
      className={`space-y-5 p-3 rounded-xl ${pageBg} h-screen overflow-y-auto`}
      style={{ height: '100vh' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Screen display</h1>
          <p className={mutedText}>
            Live view — updates automatically
            {lastUpdated ? ` • Last updated: ${formatDayMonthTime(lastUpdated)}` : ''}
          </p>
          {error && <p className="text-red-400 mt-2">{error}</p>}
          {scrollStatus && (
            <p className={`mt-1 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {scrollStatus}
            </p>
          )}
        </div>

        {/* Buttons: Dark mode + Fullscreen + TEMP Auto-scroll */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDarkMode((v) => !v)}
            className={
              darkMode
                ? 'px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100 text-sm'
                : 'px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-sm'
            }
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
          >
            {darkMode ? '☾ Dark' : '☀ Light'}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className={
              darkMode
                ? 'px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100 text-sm'
                : 'px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-sm'
            }
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? '⤢ Exit' : '⤢ Full'}
          </button>

          {/* TEMP: Auto-scroll toggle */}
          <button
            type="button"
            onClick={() => setAutoScrollEnabled((v) => !v)}
            className={
              autoScrollEnabled
                ? darkMode
                  ? 'px-3 py-2 rounded-lg border border-emerald-700 bg-emerald-900/40 hover:bg-emerald-900/55 text-emerald-100 text-sm'
                  : 'px-3 py-2 rounded-lg border border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-sm'
                : darkMode
                  ? 'px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100 text-sm'
                  : 'px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-sm'
            }
            aria-label={autoScrollEnabled ? 'Disable auto-scroll' : 'Enable auto-scroll'}
            title={autoScrollEnabled ? 'Disable auto-scroll' : 'Enable auto-scroll'}
          >
            {autoScrollEnabled ? '⇵ Scroll ON' : '⇵ Scroll OFF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-10 gap-2">
        <CounterTile label="On site" value={onSite.length} />
        <CounterTile label="Awaiting" value={awaiting.length} />
        {areaCounterTiles.map((x) => (
          <CounterTile key={x.db} label={x.label} value={x.value} />
        ))}
        {otherCount > 0 && <CounterTile label="Other" value={otherCount} />}
      </div>

      <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        “Other” counts contractors who selected any non-standard area (including entries like “Other: …”).
      </p>

      <div className={`border rounded-xl overflow-hidden ${cardBase}`}>
        <SectionHeader title="Awaiting sign-in confirmation" count={awaiting.length} tone="green" darkMode={darkMode} />
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className={`text-left text-xs uppercase tracking-wider ${theadBase}`}>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Areas</th>
              </tr>
            </thead>
            <tbody>
              {awaiting.length === 0 && (
                <tr>
                  <td className={`px-4 py-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={3}>
                    None
                  </td>
                </tr>
              )}
              {awaiting.map((i) => (
                <tr
                  key={i.id}
                  className={`border-t ${awaitingRowBg} ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}
                >
                  <td className={`px-4 py-3 font-semibold ${awaitingTextMain}`}>
                    {i.first_name} {i.surname}
                  </td>
                  <td className={`px-4 py-3 ${awaitingTextSub}`}>{i.company}</td>
                  <td className={`px-4 py-3 ${awaitingTextSub}`}>{areasTextForTables(i.areas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`border rounded-xl overflow-hidden ${cardBase}`}>
        <SectionHeader title="Signed in contractors" count={onSite.length} tone="blue" darkMode={darkMode} />
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className={`text-left text-xs uppercase tracking-wider ${theadBase}`}>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Areas</th>
                <th className="px-4 py-2">Fob #</th>
                <th className="px-4 py-2">Signed in by</th>
              </tr>
            </thead>
            <tbody>
              {onSite.length === 0 && (
                <tr>
                  <td className={`px-4 py-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={5}>
                    None
                  </td>
                </tr>
              )}

              {onSite.map((i) => {
                const awaitingSignOut = !!i.signout_requested
                const rowBg = awaitingSignOut ? signoutRowBg : ''
                const mainCls = awaitingSignOut ? signoutTextMain : darkMode ? 'text-slate-100' : 'text-slate-900'
                const subCls = awaitingSignOut ? signoutTextSub : darkMode ? 'text-slate-200' : 'text-slate-700'

                return (
                  <tr
                    key={i.id}
                    className={`border-t ${rowBg} ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}
                  >
                    <td className={`px-4 py-3 font-semibold ${mainCls}`}>
                      {i.first_name} {i.surname}
                    </td>
                    <td className={`px-4 py-3 ${subCls}`}>{i.company}</td>
                    <td className={`px-4 py-3 ${subCls}`}>{areasTextForTables(i.areas)}</td>
                    <td className={`px-4 py-3 ${subCls}`}>
                      {i.fob_number ? i.fob_number : <span className="text-slate-400">-</span>}
                    </td>
                    <td className={`px-4 py-3 ${subCls}`}>
                      {formatStaffEmail(i.sign_in_confirmed_by_email) || <span className="text-slate-400">-</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        This screen view is read-only. Use the Dashboard for confirmations and updates.
      </p>
    </section>
  )
}
