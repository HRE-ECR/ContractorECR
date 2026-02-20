import React from 'react'
import { supabase } from '../supabaseClient'

// Standard areas for totals (matches your naming)
const STANDARD_AREAS = [
  'Maint-1',
  'Maint-2',
  'Insp-shed',
  'Rep-Shed',
  '1-Clean',
  '2-Clean',
  '3-Clean',
  '4-Clean',
]

// Anything not in STANDARD_AREAS counts towards "Other"
function isOtherArea(a) {
  if (!a) return false
  const s = String(a).trim()
  if (!s) return false
  if (s.toLowerCase().startsWith('other:')) return true
  return !STANDARD_AREAS.includes(s)
}

function formatNow(ts) {
  if (!ts) return ''
  try { return new Date(ts).toLocaleString() } catch { return String(ts) }
}

export default function ScreenDisplay() {
  const [items, setItems] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [lastUpdated, setLastUpdated] = React.useState(null)
  const [error, setError] = React.useState('')

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

  // Realtime refresh (Option 1): refresh on any contractors changes
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

  // Data buckets
  const awaiting = items.filter(i => i.status === 'pending' && !i.signed_out_at)
  const onSite = items.filter(i => i.status === 'confirmed' && !i.signed_out_at)

  // Totals
  const counts = {}
  STANDARD_AREAS.forEach(a => { counts[a] = 0 })
  let otherCount = 0

  onSite.forEach(i => {
    const areas = i.areas || []
    let hasOther = false

    areas.forEach(a => {
      if (STANDARD_AREAS.includes(a)) counts[a] += 1
      else if (isOtherArea(a)) hasOther = true
    })

    // "Other" is contractor-level count: if they have any non-standard area, count them once
    if (hasOther) otherCount += 1
  })

  // Smaller, clean counter tile
  function CounterTile({ label, value }) {
    return (
      <div className="px-3 py-2 rounded-lg border border-slate-200 bg-white shadow-sm flex items-center justify-between">
        <div className="text-[11px] font-semibold text-slate-600 truncate">{label}</div>
        <div className="text-lg font-bold tabular-nums text-slate-900">{value}</div>
      </div>
    )
  }

  if (loading) return <div className="p-6 text-xl">Loading screen display…</div>

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Screen display</h1>
          <p className="text-slate-600">
            Live view — updates automatically
            {lastUpdated ? ` • Last updated: ${formatNow(lastUpdated)}` : ''}
          </p>
          {error && <p className="text-red-600 mt-2">{error}</p>}
        </div>
      </div>

      {/* Counters: all areas + Other */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-10 gap-2">
        <CounterTile label="On site" value={onSite.length} />
        <CounterTile label="Awaiting" value={awaiting.length} />

        {STANDARD_AREAS.map(a => (
          <CounterTile key={a} label={a} value={counts[a]} />
        ))}

        <CounterTile label="Other" value={otherCount} />
      </div>

      <p className="text-xs text-slate-500">
        “Other” counts contractors who selected any non-standard area (including entries like “Other: …”).
      </p>

      {/* Awaiting confirmation (grey header + green row highlight + includes fob#) */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50 font-semibold text-slate-900">
          Awaiting sign-in confirmation ({awaiting.length})
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 bg-slate-50">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Areas</th>
                <th className="px-4 py-2">Fob #</th>
              </tr>
            </thead>
            <tbody>
              {awaiting.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-slate-500" colSpan={4}>None</td>
                </tr>
              )}

              {awaiting.map(i => (
                <tr key={i.id} className="border-t bg-emerald-50/60">
                  <td className="px-4 py-3 font-semibold text-emerald-900">
                    {i.first_name} {i.surname}
                  </td>
                  <td className="px-4 py-3 text-emerald-900/90">{i.company}</td>
                  <td className="px-4 py-3 text-emerald-900/90">{(i.areas || []).join(', ')}</td>
                  <td className="px-4 py-3 text-emerald-900/90">
                    {i.fob_number ? i.fob_number : <span className="text-slate-400">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* On site (grey header + red row highlight if signout_requested = Yes) */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50 font-semibold text-slate-900">
          Signed in contractors ({onSite.length})
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 bg-slate-50">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Areas</th>
                <th className="px-4 py-2">Fob #</th>
              </tr>
            </thead>
            <tbody>
              {onSite.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-slate-500" colSpan={4}>None</td>
                </tr>
              )}

              {onSite.map(i => {
                const awaitingSignOut = !!i.signout_requested
                const rowClass = awaitingSignOut ? 'bg-rose-50/70' : ''

                return (
                  <tr key={i.id} className={`border-t ${rowClass}`}>
                    <td className={`px-4 py-3 font-semibold ${awaitingSignOut ? 'text-rose-900' : ''}`}>
                      {i.first_name} {i.surname}
                    </td>
                    <td className={`px-4 py-3 ${awaitingSignOut ? 'text-rose-900/90' : ''}`}>
                      {i.company}
                    </td>
                    <td className={`px-4 py-3 ${awaitingSignOut ? 'text-rose-900/90' : ''}`}>
                      {(i.areas || []).join(', ')}
                    </td>
                    <td className={`px-4 py-3 ${awaitingSignOut ? 'text-rose-900/90' : ''}`}>
                      {i.fob_number ? i.fob_number : <span className="text-slate-400">-</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        This screen view is read-only. Use the Dashboard for confirmations and updates.
      </p>
    </section>
  )
}
