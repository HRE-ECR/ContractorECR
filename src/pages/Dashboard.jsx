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
  Other: 'Other',
}

const SHORT_ORDER = ['M1', 'M2', 'Insp', 'RShed', '1CL', '2CL', '3CL', '4CL', 'Other']

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
  // not one of our standard DB entries AND not one of our short mapped entries
  return !STANDARD_DB_AREAS.includes(s) && !Object.prototype.hasOwnProperty.call(AREA_SHORT_MAP, s)
}

function shortArea(a) {
  if (!a) return ''
  const s = String(a).trim()
  if (!s) return ''
  if (s.toLowerCase().startsWith('other:')) return 'Other'
  if (AREA_SHORT_MAP[s]) return AREA_SHORT_MAP[s]
  if (isOtherArea(s)) return 'Other'
  return s
}

function shortAreasList(areas) {
  const arr = Array.isArray(areas) ? areas : []
  const set = new Set()

  let hasOther = false
  for (const a of arr) {
    const s = shortArea(a)
    if (!s) continue
    if (s === 'Other') hasOther = true
    else set.add(s)
  }
  if (hasOther) set.add('Other')

  const list = Array.from(set)
  list.sort((x, y) => SHORT_ORDER.indexOf(x) - SHORT_ORDER.indexOf(y))
  return list
}

function shortAreasText(areas) {
  return shortAreasList(areas).join(', ')
}

// -----------------------------
// Utilities
// -----------------------------
function formatDate(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

function shortEmail(email) {
  if (!email) return ''
  return String(email).split('@')[0]
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
// Summary (Counters)
// -----------------------------
function Summary({ items }) {
  const onSite = items.filter((i) => i.status !== 'signed_out' && !i.signed_out_at)

  // Count contractors per area (contractor counted for each area they selected)
  const counts = {}
  SHORT_ORDER.forEach((k) => {
    if (k !== 'Other') counts[k] = 0
  })
  let otherCount = 0

  onSite.forEach((i) => {
    const areas = Array.isArray(i.areas) ? i.areas : []
    let hasOther = false

    areas.forEach((a) => {
      const s = shortArea(a)
      if (!s) return
      if (s === 'Other') {
        hasOther = true
      } else if (Object.prototype.hasOwnProperty.call(counts, s)) {
        counts[s] += 1
      }
    })

    // Other is contractor-level count (not per-area)
    if (hasOther) otherCount += 1
  })

  const tile = (label, value) => {
    const cls =
      'border border-[#0b3a5a] bg-[#0b3a5a] text-white rounded-lg px-3 py-2 shadow-sm flex items-center justify-between gap-3 min-w-[86px]'
    return (
      <div className={cls} key={label}>
        <div className="text-xs font-semibold tracking-wide opacity-90">{label}</div>
        <div className="text-lg font-bold leading-none">{value}</div>
      </div>
    )
  }

  // Hide zero counters except Total
  const tiles = []
  tiles.push(tile('Total', onSite.length))

  SHORT_ORDER.forEach((k) => {
    if (k === 'Other') {
      if (otherCount > 0) tiles.push(tile('Other', otherCount))
      return
    }
    const v = counts[k] || 0
    if (v > 0) tiles.push(tile(k, v))
  })

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">{tiles}</div>
    </div>
  )
}

// -----------------------------
// Awaiting Row
// -----------------------------
function AwaitingRow({ item, onConfirm }) {
  const [fob, setFob] = React.useState('')
  return (
    <tr className="bg-emerald-50/70">
      <td className="px-2 py-2 whitespace-nowrap">
        {item.first_name} {item.surname}
      </td>
      <td className="px-2 py-2">{item.company}</td>
      <td className="px-2 py-2 whitespace-nowrap">{item.phone}</td>
      <td className="px-2 py-2">{shortAreasText(item.areas)}</td>
      <td className="px-2 py-2 whitespace-nowrap">{formatDate(item.signed_in_at)}</td>
      <td className="px-2 py-2">
        <input
          value={fob}
          onChange={(e) => setFob(e.target.value)}
          className="border rounded px-2 py-1 w-28"
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
  const [error, setError] = React.useState('')

  // Signed-out display controls (per your request)
  const [signedOutExpanded, setSignedOutExpanded] = React.useState(false) // false = last 12 hours + 5, true = last 4 days + 30

  // --- fob logic helpers
  function hasFobIssued(item) {
    const v = (item?.fob_number || '').toString().trim()
    return v.length > 0
  }

  // Sign-out rule:
  // - Teamleader: must have signout_requested = true
  // - if fob issued => must have fob_returned = true
  // - Admin override kept conservative:
  //   - If fob issued => require fob_returned true
  //   - If no fob => require signout_requested true
  function canConfirmSignOut(item) {
    if (!item) return false
    const fobIssued = hasFobIssued(item)
    if (isAdmin) {
      if (fobIssued) return !!item.fob_returned
      return !!item.signout_requested
    }
    // teamleader
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

    // Determine admin (using profiles table)
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData?.user?.id
    let admin = false

    if (uid) {
      const { data: prof, error: profErr } = await supabase.from('profiles').select('role').eq('id', uid).single()
      if (profErr) {
        // Don't hard-fail the dashboard for profile lookup errors; show message
        setError(profErr.message)
      }
      admin = prof?.role === 'admin'
      setIsAdmin(admin)
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

  // Realtime Option 1: refresh when contractors changes
  React.useEffect(() => {
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
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function confirmSignIn(itemId, fob) {
    const raw = (fob || '').toString().trim()
    let finalFob = raw

    // If empty fob, confirm no fob issued
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
      fob_number: finalFob ? finalFob : null, // null = "no fob issued"
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
    if (item && !hasFobIssued(item)) return // no fob issued

    const prevItems = items
    // optimistic UI
    setItems((curr) => curr.map((i) => (i.id === itemId ? { ...i, fob_returned: value } : i)))

    const { error } = await supabase.from('contractors').update({ fob_returned: value }).eq('id', itemId)
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
      areas: shortAreasText(i.areas),
      status: i.status,
      fob_number: i.fob_number || '',
      fob_returned: i.fob_returned ? 'true' : 'false',
      signout_requested: i.signout_requested ? 'true' : 'false',
      signed_in_at: i.signed_in_at || '',
      sign_in_confirmed_at: i.sign_in_confirmed_at || '',
      signed_out_at: i.signed_out_at || '',
      sign_in_confirmed_by: shortEmail(i.sign_in_confirmed_by_email || ''),
      signed_out_by: shortEmail(i.signed_out_by_email || ''),
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

  if (loading) return <div className="p-4">Loading...</div>

  const awaiting = items.filter((i) => i.status === 'pending' && !i.signed_out_at)
  const onSite = items.filter((i) => i.status === 'confirmed' && !i.signed_out_at)

  // Signed-out filtering per your rules:
  const now = Date.now()
  const cutoffMs = signedOutExpanded ? 4 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000
  const cutoff = now - cutoffMs

  const signedOutAll = items
    .filter((i) => i.signed_out_at)
    .filter((i) => new Date(i.signed_out_at).getTime() >= cutoff)
    .sort((a, b) => new Date(b.signed_out_at).getTime() - new Date(a.signed_out_at).getTime())

  const signedOut = signedOutAll.slice(0, signedOutExpanded ? 30 : 5)

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Contractor/Visitor details</h2>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <button
          onClick={handleRefresh}
          className="px-3 py-1 text-sm bg-slate-900 text-white rounded hover:bg-slate-800"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>

        <button
          onClick={exportAllTables}
          className="px-3 py-1 text-sm bg-slate-200 rounded hover:bg-slate-300"
        >
          Export all tables (CSV)
        </button>
      </div>

      {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

      <Summary items={items} />

      {/* Awaiting confirmation */}
      <h3 className="text-lg font-semibold mt-4 mb-2">Awaiting confirmation</h3>
      <div className="overflow-auto">
        <table className="min-w-full border border-slate-200 rounded">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-2 py-2">Name</th>
              <th className="text-left px-2 py-2">Company</th>
              <th className="text-left px-2 py-2">Phone</th>
              <th className="text-left px-2 py-2">Areas</th>
              <th className="text-left px-2 py-2">Signed in</th>
              <th className="text-left px-2 py-2">Fob #</th>
              <th className="text-left px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {awaiting.length === 0 && (
              <tr>
                <td className="px-2 py-3 text-slate-600" colSpan={7}>
                  None
                </td>
              </tr>
            )}
            {awaiting.map((i) => (
              <AwaitingRow key={i.id} item={i} onConfirm={confirmSignIn} />
            ))}
          </tbody>
        </table>
      </div>

      {/* On site */}
      <h3 className="text-lg font-semibold mt-6 mb-2">Signed in contractors/visitors</h3>
      <div className="overflow-auto">
        <table className="min-w-full border border-slate-200 rounded">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-2 py-2">Name</th>
              <th className="text-left px-2 py-2">Company</th>
              <th className="text-left px-2 py-2">Phone</th>
              <th className="text-left px-2 py-2">Areas</th>
              <th className="text-left px-2 py-2">Signed in</th>
              <th className="text-left px-2 py-2">Fob #</th>
              <th className="text-left px-2 py-2">Signed in by</th>
              <th className="text-left px-2 py-2">Fob returned</th>
              <th className="text-left px-2 py-2">Sign-out requested</th>
              <th className="text-left px-2 py-2"></th>
              {isAdmin && <th className="text-left px-2 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {onSite.length === 0 && (
              <tr>
                <td className="px-2 py-3 text-slate-600" colSpan={isAdmin ? 11 : 10}>
                  None
                </td>
              </tr>
            )}

            {onSite.map((i) => {
              const canSignOut = canConfirmSignOut(i)
              const reason = signOutDisabledReason(i)
              const fobIssued = hasFobIssued(i)
              const rowTone = i.signout_requested ? 'bg-rose-50/70' : ''

              return (
                <tr key={i.id} className={rowTone}>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {i.first_name} {i.surname}
                  </td>
                  <td className="px-2 py-2">{i.company}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{i.phone}</td>
                  <td className="px-2 py-2">{shortAreasText(i.areas)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{formatDate(i.signed_in_at)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{i.fob_number || '-'}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{shortEmail(i.sign_in_confirmed_by_email) || '-'}</td>

                  <td className="px-2 py-2 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={!!i.fob_returned}
                      disabled={!fobIssued}
                      onChange={(e) => setFobReturned(i.id, e.target.checked)}
                      className={!fobIssued ? 'cursor-not-allowed opacity-60' : ''}
                      title={!fobIssued ? 'No fob issued' : 'Tick when fob returned'}
                    />
                  </td>

                  <td className="px-2 py-2 whitespace-nowrap">{i.signout_requested ? 'Yes' : 'No'}</td>

                  <td className="px-2 py-2 whitespace-nowrap">
                    <button
                      onClick={() => confirmSignOut(i)}
                      disabled={!canSignOut}
                      title={!canSignOut ? reason : 'Confirm sign-out'}
                      className={`px-3 py-1 rounded whitespace-nowrap text-sm ${
                        canSignOut ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'
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

      {/* Signed out */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">
          Signed out (last {signedOutExpanded ? 30 : 5}{signedOutExpanded ? ', last 4 days' : ', last 12 hours'})
        </h3>

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
            className="px-3 py-1 text-sm bg-slate-200 rounded hover:bg-slate-300"
          >
            Show less
          </button>
        )}
      </div>

      <div className="overflow-auto mt-2">
        <table className="min-w-full border border-slate-200 rounded">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-2 py-2">Name</th>
              <th className="text-left px-2 py-2">Company</th>
              <th className="text-left px-2 py-2">Phone</th>
              <th className="text-left px-2 py-2">Areas</th>
              <th className="text-left px-2 py-2">Fob #</th>
              <th className="text-left px-2 py-2">Fob returned</th>
              <th className="text-left px-2 py-2">Signed in</th>
              <th className="text-left px-2 py-2">Signed out</th>
              <th className="text-left px-2 py-2">Signed in by</th>
              <th className="text-left px-2 py-2">Signed out by</th>
            </tr>
          </thead>
          <tbody>
            {signedOut.length === 0 && (
              <tr>
                <td className="px-2 py-3 text-slate-600" colSpan={10}>
                  None
                </td>
              </tr>
            )}

            {signedOut.map((i) => (
              <tr key={i.id}>
                <td className="px-2 py-2 whitespace-nowrap">
                  {i.first_name} {i.surname}
                </td>
                <td className="px-2 py-2">{i.company}</td>
                <td className="px-2 py-2 whitespace-nowrap">{i.phone}</td>
                <td className="px-2 py-2">{shortAreasText(i.areas)}</td>
                <td className="px-2 py-2 whitespace-nowrap">{i.fob_number || '-'}</td>
                <td className="px-2 py-2 whitespace-nowrap">{i.fob_returned ? 'Yes' : 'No'}</td>
                <td className="px-2 py-2 whitespace-nowrap">{formatDate(i.signed_in_at)}</td>
                <td className="px-2 py-2 whitespace-nowrap">{formatDate(i.signed_out_at)}</td>
                <td className="px-2 py-2 whitespace-nowrap">{shortEmail(i.sign_in_confirmed_by_email) || '-'}</td>
                <td className="px-2 py-2 whitespace-nowrap">{shortEmail(i.signed_out_by_email) || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-slate-600">
        Signed-out records are kept for up to 30 days and then automatically removed.
      </div>
    </div>
  )
}
