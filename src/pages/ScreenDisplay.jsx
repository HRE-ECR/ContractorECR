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

const STANDARD_DB_AREAS = ['Maint-1', 'Maint-2', 'Insp-shed', 'Rep-Shed', '1-Clean', '2-Clean', '3-Clean', '4-Clean']
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
  if (lower.startsWith('other:')) return s.slice(s.indexOf(':') + 1).trim()
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
  for (const a of arr) if (extractOtherText(a)) return true
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
  const surname = ((lastPart[0] || '').toUpperCase() + (lastPart.slice(1) || '').toLowerCase()).trim()
  if (!initial || !surname) return local
  return `${initial}.${surname}`
}

// -----------------------------
// Solid section header (minimal height)
// -----------------------------
function SectionHeader({ title, count, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-900 text-white',
    blue: 'bg-[#0b3a5a] text-white',
    green: 'bg-emerald-700 text-white',
  }
  const cls = tones[tone] || tones.slate
  return (
    <div className={`px-3 py-1.5 font-semibold flex items-center justify-between ${cls}`}>
      <div className="text-[12px] tracking-wide">
        {title}
        {typeof count === 'number' ? ` (${count})` : ''}
      </div>
    </div>
  )
}

/**
 * Ping-pong auto-scroll hook:
 * - Scrolls down → pauses → scrolls up → pauses → repeats.
 * - Does NOT bail out if overflow isn't ready yet (prevents "only scrolls after alt-tab").
 * - Resyncs timing when tab becomes visible/focused.
 */
function usePingPongAutoScroll({ ref, enabled, speedPxPerSec = 18, pauseMs = 1200, resetKey }) {
  React.useEffect(() => {
    if (!enabled) return

    const el = ref.current
    if (!el) return

    // Reset to top each time we restart
    el.scrollTop = 0

    let rafId = null
    let last = performance.now()
    let dir = 1 // 1 down, -1 up
    let phase = 'scroll' // 'scroll' | 'pause'
    let pauseUntil = 0

    const step = (now) => {
      const node = ref.current
      if (!node) return

      // If tab was inactive, avoid huge dt jump
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)) // clamp dt
      last = now

      // Always recompute overflow — layout can change after fonts load
      const maxScroll = Math.max(0, node.scrollHeight - node.clientHeight)

      if (maxScroll <= 1) {
        // No overflow yet: keep checking (DON'T bail)
        node.scrollTop = 0
        rafId = requestAnimationFrame(step)
        return
      }

      if (phase === 'pause') {
        if (now >= pauseUntil) phase = 'scroll'
        rafId = requestAnimationFrame(step)
        return
      }

      // phase === 'scroll'
      node.scrollTop = Math.min(maxScroll, Math.max(0, node.scrollTop + dir * speedPxPerSec * dt))

      const atTop = node.scrollTop <= 0.5
      const atBottom = node.scrollTop >= maxScroll - 0.5

      if ((dir === 1 && atBottom) || (dir === -1 && atTop)) {
        phase = 'pause'
        pauseUntil = now + pauseMs
        dir *= -1
      }

      rafId = requestAnimationFrame(step)
    }

    const resync = () => {
      // Reset timing so animation continues smoothly when returning to the tab/window
      last = performance.now()
    }

    document.addEventListener('visibilitychange', resync)
    window.addEventListener('focus', resync)

    rafId = requestAnimationFrame(step)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('focus', resync)
    }
  }, [enabled, ref, speedPxPerSec, pauseMs, resetKey])
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

  // Scroll refs for auto-scrolling tables
  const signedInScrollRef = React.useRef(null)
  const awaitingScrollRef = React.useRef(null)

  // -----------------------------
  // Global styles:
  // - Hide nav in fullscreen
  // - Hide scrollbars until hover (mouse near)
  // -----------------------------
  React.useEffect(() => {
    const styleId = 'screen-display-global-style'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        body.screen-display-fullscreen nav { display: none !important; }
        body.screen-display-fullscreen header { display: none !important; }
        body.screen-display-fullscreen .app-navbar { display: none !important; }
        body.screen-display-fullscreen .navbar { display: none !important; }

        /* Hide scrollbars until hover */
        .scrollbar-hide-until-hover {
          scrollbar-width: none;       /* Firefox */
          -ms-overflow-style: none;    /* IE/Edge legacy */
        }
        .scrollbar-hide-until-hover::-webkit-scrollbar {
          width: 0px;
          height: 0px;
        }
        .scrollbar-hide-until-hover:hover {
          scrollbar-width: thin;       /* Firefox */
        }
        .scrollbar-hide-until-hover:hover::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .scrollbar-hide-until-hover:hover::-webkit-scrollbar-thumb {
          background: rgba(100,116,139,0.55);
          border-radius: 999px;
        }
        .scrollbar-hide-until-hover:hover::-webkit-scrollbar-track {
          background: rgba(15,23,42,0.08);
        }
      `
      document.head.appendChild(style)
    }
  }, [])

  // Keep body class in sync (fullscreen hides nav)
  React.useEffect(() => {
    try {
      document.body.classList.toggle('screen-display-fullscreen', isFullscreen)
    } catch {
      // ignore
    }
  }, [isFullscreen])

  // Track fullscreen changes (ESC / user exit)
  React.useEffect(() => {
    function onFsChange() {
      const fsEl =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      setIsFullscreen(!!fsEl)
    }

    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange)
    document.addEventListener('mozfullscreenchange', onFsChange)
    document.addEventListener('MSFullscreenChange', onFsChange)

    onFsChange()
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange)
      document.removeEventListener('mozfullscreenchange', onFsChange)
      document.removeEventListener('MSFullscreenChange', onFsChange)
    }
  }, [])

  async function enterFullscreen() {
    setError('')
    try {
      const el = document.documentElement
      if (el.requestFullscreen) await el.requestFullscreen()
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
      else if (el.mozRequestFullScreen) await el.mozRequestFullScreen()
      else if (el.msRequestFullscreen) await el.msRequestFullscreen()
      else setError('Fullscreen is not supported on this browser.')
    } catch (e) {
      setError(e?.message || 'Failed to enter fullscreen.')
    }
  }

  async function exitFullscreen() {
    setError('')
    try {
      if (document.exitFullscreen) await document.exitFullscreen()
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen()
      else if (document.mozCancelFullScreen) await document.mozCancelFullScreen()
      else if (document.msExitFullscreen) await document.msExitFullscreen()
    } catch (e) {
      setError(e?.message || 'Failed to exit fullscreen.')
    }
  }

  async function toggleFullscreen() {
    const fsEl =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    if (fsEl) await exitFullscreen()
    else await enterFullscreen()
  }

  // Dark mode load/save
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('screenDisplayDarkMode')
      if (saved === 'true' || saved === 'false') setDarkMode(saved === 'true')
      else if (window?.matchMedia) setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
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

  const loadRef = React.useRef(null)

  async function load() {
    setError('')
    const { data, error: err } = await supabase
      .from('contractors')
      .select('*')
      .order('signed_in_at', { ascending: false })
      .limit(500)

    if (err) setError(err.message)
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

  // Realtime
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

  const awaiting = items.filter((i) => i.status === 'pending' && !i.signed_out_at)

  // Awaiting sign-out at top (then newest signed-in first)
  const onSite = React.useMemo(() => {
    const list = items.filter((i) => i.status === 'confirmed' && !i.signed_out_at)
    return list.slice().sort((a, b) => {
      const aAwait = a.signout_requested ? 1 : 0
      const bAwait = b.signout_requested ? 1 : 0
      if (aAwait !== bAwait) return bAwait - aAwait

      const at = a.signed_in_at ? new Date(a.signed_in_at).getTime() : 0
      const bt = b.signed_in_at ? new Date(b.signed_in_at).getTime() : 0
      return bt - at
    })
  }, [items])

  // -----------------------------
  // Compact sizing + scroll thresholds
  // -----------------------------
  const SIGNED_IN_VISIBLE_ROWS = 5
  const AWAITING_VISIBLE_ROWS = 2

  // Compact row/header sizes (reduced "fat")
  const ROW_PX = 44
  const HEAD_PX = 34

  const signedInMaxHeight = HEAD_PX + SIGNED_IN_VISIBLE_ROWS * ROW_PX
  const awaitingMaxHeight = HEAD_PX + AWAITING_VISIBLE_ROWS * ROW_PX

  const shouldAutoScrollSignedIn = onSite.length > SIGNED_IN_VISIBLE_ROWS
  const shouldAutoScrollAwaiting = awaiting.length > AWAITING_VISIBLE_ROWS

  // ✅ Auto-scroll: down/up with pauses at top & bottom
  // resetKey uses lastUpdated to force a clean restart after data refresh
  usePingPongAutoScroll({
    ref: signedInScrollRef,
    enabled: shouldAutoScrollSignedIn,
    speedPxPerSec: 18,
    pauseMs: 1200,
    resetKey: `${onSite.length}-${lastUpdated || 0}`,
  })

  usePingPongAutoScroll({
    ref: awaitingScrollRef,
    enabled: shouldAutoScrollAwaiting,
    speedPxPerSec: 18,
    pauseMs: 1200,
    resetKey: `${awaiting.length}-${lastUpdated || 0}`,
  })

  // Counts
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
      'px-2.5 py-1.5 rounded-lg border shadow-sm flex items-center justify-between border-[#0b3a5a] bg-[#0b3a5a] text-white'
    return (
      <div className={tileCls}>
        <div className="text-[10px] font-semibold truncate opacity-90">{label}</div>
        <div className="text-base font-bold tabular-nums">{value}</div>
      </div>
    )
  }

  const pageBg = darkMode ? 'bg-slate-950 text-slate-100' : 'bg-transparent text-slate-900'
  const mutedText = darkMode ? 'text-slate-300' : 'text-slate-600'
  const cardBase = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
  const theadBase = darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-500'

  // Deeper + brighter highlights
  const awaitingRowBg = darkMode ? 'bg-emerald-800/55' : 'bg-emerald-200/90'
  const awaitingTextMain = darkMode ? 'text-emerald-50' : 'text-emerald-950'
  const awaitingTextSub = darkMode ? 'text-emerald-100/95' : 'text-emerald-900'

  const signoutRowBg = darkMode ? 'bg-rose-800/55' : 'bg-rose-200/90'
  const signoutTextMain = darkMode ? 'text-rose-50' : 'text-rose-950'
  const signoutTextSub = darkMode ? 'text-rose-100/95' : 'text-rose-900'

  // Compact badge styles
  const signoutBadgeCls = darkMode
    ? 'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-rose-300/30 bg-rose-950/30 text-rose-50'
    : 'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-rose-300 bg-rose-100 text-rose-900'

  const awaitingBadgeCls = darkMode
    ? 'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-300/30 bg-emerald-950/30 text-emerald-50'
    : 'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-300 bg-emerald-100 text-emerald-900'

  if (loading) return <div className="p-4 text-lg">Loading screen display…</div>

  const areaCounterTiles = STANDARD_DB_AREAS
    .map((a) => ({ db: a, label: counterLabel(a), value: counts[a] || 0 }))
    .filter((x) => x.value > 0)
    .sort((x, y) => SHORT_ORDER.indexOf(x.label) - SHORT_ORDER.indexOf(y.label))

  const fullscreenShell = isFullscreen ? 'fixed inset-0 z-50 overflow-auto rounded-none' : 'rounded-xl'

  return (
    <section className={`space-y-4 p-2 ${fullscreenShell} ${pageBg}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Screen display</h1>
          <p className={`text-sm ${mutedText}`}>
            Live view — updates automatically
            {lastUpdated ? ` • Last updated: ${formatDayMonthTime(lastUpdated)}` : ''}
          </p>
          {error && <p className="text-red-400 mt-1 text-sm">{error}</p>}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDarkMode((v) => !v)}
            className={
              darkMode
                ? 'px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100 text-sm'
                : 'px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-sm'
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
                ? 'px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100 text-sm'
                : 'px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-sm'
            }
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? '🗗 Exit' : '⛶ Full'}
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

      <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        “Other” counts contractors who selected any non-standard area (including entries like “Other: …”).
      </p>

      {/* Awaiting sign-in: auto-hide when empty; lock to 2 rows then auto-scroll */}
      {awaiting.length > 0 && (
        <div className={`border rounded-xl overflow-hidden ${cardBase}`}>
          <SectionHeader title="Awaiting sign-in confirmation" count={awaiting.length} tone="green" />

          <div className="overflow-x-auto">
            <div
              ref={awaitingScrollRef}
              className={`overflow-y-auto scrollbar-hide-until-hover`}
              style={{ maxHeight: shouldAutoScrollAwaiting ? awaitingMaxHeight : 'none' }}
            >
              <table className="min-w-full">
                <thead className="sticky top-0 z-10">
                  <tr className={`text-left text-[11px] uppercase tracking-wider ${theadBase}`}>
                    <th className="px-3 py-1.5">Name</th>
                    <th className="px-3 py-1.5">Company</th>
                    <th className="px-3 py-1.5">Areas</th>
                  </tr>
                </thead>
                <tbody>
                  {awaiting.map((i) => (
                    <tr
                      key={i.id}
                      className={`border-t ${awaitingRowBg} ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}
                    >
                      <td className={`px-3 py-2 font-semibold ${awaitingTextMain}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>
                            {i.first_name} {i.surname}
                          </span>
                          <span className={awaitingBadgeCls} aria-label="Awaiting sign-in" title="Awaiting sign-in">
                            ⏳ <span>Awaiting sign-in</span>
                          </span>
                        </div>
                      </td>
                      <td className={`px-3 py-2 ${awaitingTextSub}`}>{i.company}</td>
                      <td className={`px-3 py-2 ${awaitingTextSub}`}>{areasTextForTables(i.areas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Signed-in: lock to 5 rows then auto-scroll */}
      <div className={`border rounded-xl overflow-hidden ${cardBase}`}>
        <SectionHeader title="Signed in contractors" count={onSite.length} tone="blue" />

        <div className="overflow-x-auto">
          <div
            ref={signedInScrollRef}
            className={`overflow-y-auto scrollbar-hide-until-hover`}
            style={{ maxHeight: shouldAutoScrollSignedIn ? signedInMaxHeight : 'none' }}
          >
            <table className="min-w-full">
              <thead className="sticky top-0 z-10">
                <tr className={`text-left text-[11px] uppercase tracking-wider ${theadBase}`}>
                  <th className="px-3 py-1.5">Name</th>
                  <th className="px-3 py-1.5">Company</th>
                  <th className="px-3 py-1.5">Areas</th>
                  <th className="px-3 py-1.5">Fob #</th>
                  <th className="px-3 py-1.5">Signed in by</th>
                </tr>
              </thead>

              <tbody>
                {onSite.length === 0 && (
                  <tr>
                    <td className={`px-3 py-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} colSpan={5}>
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
                      <td className={`px-3 py-2 font-semibold ${mainCls}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>
                            {i.first_name} {i.surname}
                          </span>

                          {awaitingSignOut && (
                            <span className={signoutBadgeCls} aria-label="Awaiting sign-out" title="Awaiting sign-out">
                              ⏳ <span>Awaiting sign-out</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className={`px-3 py-2 ${subCls}`}>{i.company}</td>
                      <td className={`px-3 py-2 ${subCls}`}>{areasTextForTables(i.areas)}</td>

                      <td className={`px-3 py-2 ${subCls}`}>
                        {i.fob_number ? i.fob_number : <span className="text-slate-400">-</span>}
                      </td>

                      <td className={`px-3 py-2 ${subCls}`}>
                        {formatStaffEmail(i.sign_in_confirmed_by_email) || <span className="text-slate-400">-</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        This screen view is read-only. Use the Dashboard for confirmations and updates.
      </p>
    </section>
  )
}
