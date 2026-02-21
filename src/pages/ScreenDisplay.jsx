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
 * Detects whether an element is actually overflowed (scrollable vertically).
 * Uses ResizeObserver + periodic recheck to cope with font/table layout settling.
 */
function useIsOverflowing(ref, depsKey) {
  const [overflowing, setOverflowing] = React.useState(false)

  React.useEffect(() => {
    let ro = null
    let intervalId = null
    let raf1 = null
    let raf2 = null

    const check = () => {
      const el = ref.current
      if (!el) return
      const has = el.scrollHeight > el.clientHeight + 1
      setOverflowing(has)
    }

    // Delay checks to allow table/layout/fonts to settle
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        check()
      })
    })

    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => check())
      if (ref.current) ro.observe(ref.current)
    }

    // Also recheck periodically (covers sticky table/layout quirks)
    intervalId = window.setInterval(check, 800)

    // Recheck on visibility/focus
    const onVis = () => check()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)

    return () => {
      if (raf1) cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
      if (intervalId) clearInterval(intervalId)
      if (ro) ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
    }
  }, [ref, depsKey])

  return overflowing
}

/**
 * Robust ping-pong auto-scroll driven by setInterval.
 * Scrolls down -> pause -> up -> pause -> repeat.
 *
 * NOTE: We only reset scrollTop when resetKey changes (data/layout change),
 * NOT when you pause/resume.
 */
function usePingPongAutoScroll({ ref, enabled, resetKey, speedPxPerSec = 16, pauseMs = 1400, tickMs = 33 }) {
  const prevResetKeyRef = React.useRef(null)

  React.useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return

    // Only reset position when resetKey changes (e.g. data refresh),
    // not when user pauses/resumes.
    if (prevResetKeyRef.current !== resetKey) {
      el.scrollTop = 0
      prevResetKeyRef.current = resetKey
    }

    let dir = 1 // 1 down, -1 up
    let phase = 'scroll' // 'scroll' | 'pause'
    let pauseUntil = 0
    let last = performance.now()
    let timerId = null

    const tick = () => {
      const node = ref.current
      if (!node) return

      const now = performance.now()
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now

      const maxScroll = Math.max(0, node.scrollHeight - node.clientHeight)
      if (maxScroll <= 1) {
        node.scrollTop = 0
        return
      }

      if (phase === 'pause') {
        if (now >= pauseUntil) phase = 'scroll'
        return
      }

      const next = node.scrollTop + dir * speedPxPerSec * dt
      node.scrollTop = Math.min(maxScroll, Math.max(0, next))

      const atTop = node.scrollTop <= 0.5
      const atBottom = node.scrollTop >= maxScroll - 0.5

      if ((dir === 1 && atBottom) || (dir === -1 && atTop)) {
        phase = 'pause'
        pauseUntil = now + pauseMs
        dir *= -1
      }
    }

    // Start after layout settles
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => {
        last = performance.now()
        timerId = window.setInterval(tick, tickMs)
      })
      usePingPongAutoScroll._r2Cleanup = () => cancelAnimationFrame(r2)
    })

    const resync = () => {
      last = performance.now()
    }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('focus', resync)

    return () => {
      cancelAnimationFrame(r1)
      if (usePingPongAutoScroll._r2Cleanup) usePingPongAutoScroll._r2Cleanup()
      if (timerId) clearInterval(timerId)
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('focus', resync)
    }
  }, [enabled, ref, resetKey, speedPxPerSec, pauseMs, tickMs])
}

export default function ScreenDisplay() {
  const [items, setItems] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [lastUpdated, setLastUpdated] = React.useState(null)
  const [error, setError] = React.useState('')

  const [darkMode, setDarkMode] = React.useState(false)
  const [isFullscreen, setIsFullscreen] = React.useState(false)

  // ✅ NEW: Pause/Resume auto-scroll
  const [autoScrollPaused, setAutoScrollPaused] = React.useState(false)

  // ✅ NEW: Hide cursor when idle in fullscreen
  const [cursorHidden, setCursorHidden] = React.useState(false)

  const signedInScrollRef = React.useRef(null)
  const awaitingScrollRef = React.useRef(null)

  // Global styles: fullscreen nav hide + scrollbar hide-until-hover + cursor hide class
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

        /* Hide cursor when idle (fullscreen only) */
        body.screen-display-cursor-hidden {
          cursor: none !important;
        }
        body.screen-display-cursor-hidden * {
          cursor: none !important;
        }

        /* Hide scrollbars until hover */
        .scrollbar-hide-until-hover {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .scrollbar-hide-until-hover::-webkit-scrollbar {
          width: 0px;
          height: 0px;
        }
        .scrollbar-hide-until-hover:hover {
          scrollbar-width: thin;
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
          background: rgba(15,23,42,0.10);
        }
      `
      document.head.appendChild(style)
    }
  }, [])

  // body class for fullscreen nav hiding
  React.useEffect(() => {
    try {
      document.body.classList.toggle('screen-display-fullscreen', isFullscreen)
    } catch {
      // ignore
    }
  }, [isFullscreen])

  // ✅ Apply cursor hidden class (only meaningful in fullscreen)
  React.useEffect(() => {
    try {
      const shouldHide = isFullscreen && cursorHidden
      document.body.classList.toggle('screen-display-cursor-hidden', shouldHide)
    } catch {
      // ignore
    }
  }, [isFullscreen, cursorHidden])

  // ✅ Cursor idle detection in fullscreen
  React.useEffect(() => {
    if (!isFullscreen) {
      setCursorHidden(false)
      return
    }

    let t = null
    const IDLE_MS = 2000

    const showAndReset = () => {
      setCursorHidden(false)
      if (t) clearTimeout(t)
      t = setTimeout(() => setCursorHidden(true), IDLE_MS)
    }

    // Start timer immediately on entering fullscreen
    showAndReset()

    window.addEventListener('mousemove', showAndReset, { passive: true })
    window.addEventListener('mousedown', showAndReset, { passive: true })
    window.addEventListener('touchstart', showAndReset, { passive: true })
    window.addEventListener('keydown', showAndReset)

    return () => {
      if (t) clearTimeout(t)
      window.removeEventListener('mousemove', showAndReset)
      window.removeEventListener('mousedown', showAndReset)
      window.removeEventListener('touchstart', showAndReset)
      window.removeEventListener('keydown', showAndReset)
    }
  }, [isFullscreen])

  // fullscreen change tracking
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

  async function toggleFullscreen() {
    try {
      const fsEl =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement

      if (fsEl) {
        if (document.exitFullscreen) await document.exitFullscreen()
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen()
        else if (document.mozCancelFullScreen) await document.mozCancelFullScreen()
        else if (document.msExitFullscreen) await document.msExitFullscreen()
      } else {
        const el = document.documentElement
        if (el.requestFullscreen) await el.requestFullscreen()
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
        else if (el.mozRequestFullScreen) await el.mozRequestFullScreen()
        else if (el.msRequestFullscreen) await el.msRequestFullscreen()
      }
    } catch (e) {
      setError(e?.message || 'Fullscreen failed.')
    }
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

  // --- thresholds / sizing ---
  const SIGNED_IN_VISIBLE_ROWS = 5
  const AWAITING_VISIBLE_ROWS = 2
  const ROW_PX = 44
  const HEAD_PX = 34
  const signedInMaxHeight = HEAD_PX + SIGNED_IN_VISIBLE_ROWS * ROW_PX
  const awaitingMaxHeight = HEAD_PX + AWAITING_VISIBLE_ROWS * ROW_PX

  const lockSignedIn = onSite.length > SIGNED_IN_VISIBLE_ROWS
  const lockAwaiting = awaiting.length > AWAITING_VISIBLE_ROWS

  // overflow detection
  const signedInOverflowing = useIsOverflowing(signedInScrollRef, `${onSite.length}-${lastUpdated || 0}`)
  const awaitingOverflowing = useIsOverflowing(awaitingScrollRef, `${awaiting.length}-${lastUpdated || 0}`)

  // enable when >N AND overflow exists AND not paused
  const enableSignedInAutoScroll = lockSignedIn && signedInOverflowing && !autoScrollPaused
  const enableAwaitingAutoScroll = lockAwaiting && awaitingOverflowing && !autoScrollPaused

  // whether we have any auto-scroll eligible right now (used to disable button when pointless)
  const autoScrollEligible = (lockSignedIn && signedInOverflowing) || (lockAwaiting && awaitingOverflowing)

  // auto scroll (ping-pong)
  usePingPongAutoScroll({
    ref: signedInScrollRef,
    enabled: enableSignedInAutoScroll,
    resetKey: `${onSite.length}-${lastUpdated || 0}`,
    speedPxPerSec: 16,
    pauseMs: 1400,
    tickMs: 33,
  })

  usePingPongAutoScroll({
    ref: awaitingScrollRef,
    enabled: enableAwaitingAutoScroll,
    resetKey: `${awaiting.length}-${lastUpdated || 0}`,
    speedPxPerSec: 16,
    pauseMs: 1400,
    tickMs: 33,
  })

  // Counts
  const counts = {}
  STANDARD_DB_AREAS.forEach((a) => (counts[a] = 0))
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
    return (
      <div className="px-2.5 py-1.5 rounded-lg border shadow-sm flex items-center justify-between border-[#0b3a5a] bg-[#0b3a5a] text-white">
        <div className="text-[10px] font-semibold truncate opacity-90">{label}</div>
        <div className="text-base font-bold tabular-nums">{value}</div>
      </div>
    )
  }

  const pageBg = darkMode ? 'bg-slate-950 text-slate-100' : 'bg-transparent text-slate-900'
  const mutedText = darkMode ? 'text-slate-300' : 'text-slate-600'
  const cardBase = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
  const theadBase = darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-500'

  const awaitingRowBg = darkMode ? 'bg-emerald-800/55' : 'bg-emerald-200/90'
  const awaitingTextMain = darkMode ? 'text-emerald-50' : 'text-emerald-950'
  const awaitingTextSub = darkMode ? 'text-emerald-100/95' : 'text-emerald-900'

  const signoutRowBg = darkMode ? 'bg-rose-800/55' : 'bg-rose-200/90'
  const signoutTextMain = darkMode ? 'text-rose-50' : 'text-rose-950'
  const signoutTextSub = darkMode ? 'text-rose-100/95' : 'text-rose-900'

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

  const btnBaseDark = 'px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100 text-sm'
  const btnBaseLight = 'px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-sm'
  const btnDisabledDark = 'px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-500 text-sm cursor-not-allowed'
  const btnDisabledLight = 'px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 text-sm cursor-not-allowed'

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
          {/* Pause/Resume auto scroll */}
          <button
            type="button"
            onClick={() => setAutoScrollPaused((v) => !v)}
            disabled={!autoScrollEligible}
            className={
              !autoScrollEligible
                ? darkMode
                  ? btnDisabledDark
                  : btnDisabledLight
                : darkMode
                  ? btnBaseDark
                  : btnBaseLight
            }
            aria-label={autoScrollPaused ? 'Resume auto scroll' : 'Pause auto scroll'}
            title={!autoScrollEligible ? 'Auto scroll not active' : autoScrollPaused ? 'Resume auto scroll' : 'Pause auto scroll'}
          >
            {autoScrollPaused ? '▶ Scroll' : '⏸ Pause'}
          </button>

          {/* Dark/Light */}
          <button
            type="button"
            onClick={() => setDarkMode((v) => !v)}
            className={darkMode ? btnBaseDark : btnBaseLight}
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
          >
            {darkMode ? '☾ Dark' : '☀ Light'}
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={darkMode ? btnBaseDark : btnBaseLight}
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

      {/* Awaiting sign-in (hide when empty). Lock to 2 rows; auto-scroll when overflow + >2 */}
      {awaiting.length > 0 && (
        <div className={`border rounded-xl overflow-hidden ${cardBase}`}>
          <SectionHeader title="Awaiting sign-in confirmation" count={awaiting.length} tone="green" />

          <div className="overflow-x-auto">
            <div
              ref={awaitingScrollRef}
              className="overflow-y-auto scrollbar-hide-until-hover"
              style={{ maxHeight: lockAwaiting ? awaitingMaxHeight : 'none' }}
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
                          <span className={awaitingBadgeCls} title="Awaiting sign-in">
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

      {/* Signed-in contractors. Lock to 5 rows; auto-scroll when overflow + >5 */}
      <div className={`border rounded-xl overflow-hidden ${cardBase}`}>
        <SectionHeader title="Signed in contractors" count={onSite.length} tone="blue" />

        <div className="overflow-x-auto">
          <div
            ref={signedInScrollRef}
            className="overflow-y-auto scrollbar-hide-until-hover"
            style={{ maxHeight: lockSignedIn ? signedInMaxHeight : 'none' }}
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
                            <span className={signoutBadgeCls} title="Awaiting sign-out">
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
