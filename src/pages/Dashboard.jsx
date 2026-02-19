import React from 'react'
import { supabase } from '../supabaseClient'

const NL = String.fromCharCode(10)

// Standard areas (renamed)
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

function isOtherArea(a) {
  if (!a) return false
  const s = String(a).trim()
  if (!s) return false
  if (s.toLowerCase().startsWith('other:')) return true
  return !STANDARD_AREAS.includes(s)
}

function Summary({ items }) {
  const onSite = items.filter(i => i.status !== 'signed_out' && !i.signed_out_at)

  // count contractors per area (contractor counted for each area they selected)
  const counts = {}
  STANDARD_AREAS.forEach(a => { counts[a] = 0 })
  let otherCount = 0

  onSite.forEach(i => {
    const areas = i.areas || []
    let hasOther = false

    areas.forEach(a => {
      if (STANDARD_AREAS.includes(a)) {
        counts[a] += 1
      } else if (isOtherArea(a)) {
        hasOther = true
      }
    })

    // Other is a contractor-level count (not per-area)
    if (hasOther) otherCount += 1
  })

  const chip = (label, value, icon, tone) => {
    const tones = {
      slate: 'bg-slate-50 border-slate-200 text-slate-900',
      blue: 'bg-blue-50 border-blue-200 text-blue-900',
      green: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      red: 'bg-rose-50 border-rose-200 text-rose-900',
      amber: 'bg-amber-50 border-amber-200 text-amber-900',
    }
    const cls = tones[tone] || tones.slate

    return (
      <div className={`flex items-center justify-between gap-2 px-3 py-2 border rounded-lg ${cls}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm" aria-hidden="true">{icon}</span>
          <span className="text-xs font-semibold truncate">{label}</span>
        </div>
        <span className="text-sm font-bold tabular-nums">{value}</span>
      </div>
    )
  }

  return (
    <div className="space-y-2 mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {chip('Total on site', onSite.length, '👷', 'slate')}
        {chip('Maint-1', counts['Maint-1'], '🚂', 'blue')}
        {chip('Maint-2', counts['Maint-2'], '🚂', 'blue')}
        {chip('Insp-shed', counts['Insp-shed'], '🚂', 'blue')}
        {chip('Rep-Shed', counts['Rep-Shed'], '🚂', 'blue')}
        {chip('1-Clean', counts['1-Clean'], '🧽', 'green')}
        {chip('2-Clean', counts['2-Clean'], '🧽', 'green')}
        {chip('3-Clean', counts['3-Clean'], '🧽', 'green')}
        {chip('4-Clean', counts['4-Clean'], '🧽', 'green')}
        {chip('Other', otherCount, '➕', 'slate')}
      </div>
      <p className="text-xs text-slate-500">
        “Other” counts contractors who selected any non-standard area (including entries like “Other: …”).
      </p>
    </div>
  )
}

function formatDate(value) {
  if (!value) return ''
  try { return new Date(value).toLocaleString() } catch { return String(value) }
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
  const lines = rows.map(r => Object.values(r).map(csvEscape).join(','))
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

function Table({ children }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">{children}</table>
    </div>
  )
}

function Th({ children }) {
  return (
    <th className="text-left text-xs uppercase tracking-wider text-slate-500 px-4 py-2">
      {children}
    </th>
  )
}

function Td({ children, className = '', ...rest }) {
  return (
    <td {...rest} className={`px-4 py-2 align-middle ${className}`}>
      {children}
    </td>
  )
}

function AwaitingRow({ item, onConfirm }) {
  const [fob, setFob] = React.useState('')

  return (
    <tr className="border-t bg-emerald-50/60">
      <Td className="font-semibold text-emerald-900">{item.first_name} {item.surname}</Td>
      <Td className="text-emerald-900/90">{item.company}</Td>
      <Td className="text-emerald-900/90">{item.phone}</Td>
      <Td className="text-emerald-900/90">{(item.areas || []).join(', ')}</Td>
      <Td className="text-emerald-900/90">{formatDate(item.signed_in_at)}</Td>
      <Td>
        <input
          className="border rounded p-1 w-32 bg-white"
          placeholder="Enter fob #"
          value={fob}
          onChange={e => setFob(e.target.value)}
        />
      </Td>
      <Td>
        <button
          onClick={() => onConfirm(item.id, fob)}
          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Confirm sign-in
        </button>
      </Td>
    </tr>
  )
}

export default function Dashboard() {
  const [items, setItems] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [error, setError] = React.useState('')
  const [signedOutLimit, setSignedOutLimit] = React.useState(10)

  // --- fob logic helpers
  function hasFobIssued(item) {
    const v = (item?.fob_number || '').toString().trim()
    return v.length > 0
  }

  // Sign-out rule:
  // - Teamleader: must have signout_requested = true
  //   - if fob issued => must have fob_returned = true
  //   - if no fob => no fob_returned needed
  // - Admin: keep your prior admin override? (we keep conservative)
  //   - If fob issued => require fob_returned true; signout_requested not required (as you previously wanted)
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

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id

    let admin = false
    if (uid) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .single()

      admin = (prof?.role === 'admin')
      setIsAdmin(admin)
    }

    const { data, error } = await supabase
      .from('contractors')
      .select('*')
      .order('signed_in_at', { ascending: false })
      .limit(500)

    if (error) setError(error.message)
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

    // NEW: if empty fob, ask to confirm no fob issued
    let finalFob = raw
    if (!finalFob) {
      const ok = confirm('No fob number entered. Confirm that no fob is required or being issued?')
      if (!ok) return
      finalFob = '' // store empty => treated as no fob issued
    }

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id || null
    const email = userData.user?.email || null

    const updatePayload = {
      status: 'confirmed',
      sign_in_confirmed_at: new Date().toISOString(),
      sign_in_confirmed_by: uid,
      sign_in_confirmed_by_email: email,
      fob_number: finalFob ? finalFob : null, // null means "no fob issued"
    }

    const { error } = await supabase
      .from('contractors')
      .update(updatePayload)
      .eq('id', itemId)

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
    const uid = userData.user?.id || null
    const email = userData.user?.email || null

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
    const item = items.find(x => x.id === itemId)
    if (item && !hasFobIssued(item)) {
      // no fob issued - checkbox should be disabled anyway
      return
    }

    const prevItems = items
    setItems(curr => curr.map(i => (i.id === itemId ? { ...i, fob_returned: value } : i)))

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
    const awaiting = items.filter(i => i.status === 'pending' && !i.signed_out_at)
    const onSite = items.filter(i => i.status === 'confirmed' && !i.signed_out_at)

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const signedOut = items
      .filter(i => i.signed_out_at)
      .filter(i => new Date(i.signed_out_at).getTime() >= sevenDaysAgo)

    const toRow = (i, tableName) => ({
      table: tableName,
      id: i.id,
      first_name: i.first_name,
      surname: i.surname,
      company: i.company,
      phone: i.phone,
      areas: (i.areas || []).join(' | '),
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
      ...awaiting.map(i => toRow(i, 'awaiting_confirmation')),
      ...onSite.map(i => toRow(i, 'on_site')),
      ...signedOut.map(i => toRow(i, 'signed_out')),
    ]

    if (rows.length === 0) return alert('No data to export')
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    downloadCsv(`contractors_export_${stamp}.csv`, rows)
  }

  if (loading) return <div className="p-6">Loading...</div>

  const awaiting = items.filter(i => i.status === 'pending' && !i.signed_out_at)
  const onSite = items.filter(i => i.status === 'confirmed' && !i.signed_out_at)

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const signedOutAll = items
    .filter(i => i.signed_out_at)
    .filter(i => new Date(i.signed_out_at).getTime() >= sevenDaysAgo)
    .sort((a, b) => new Date(b.signed_out_at).getTime() - new Date(a.signed_out_at).getTime())

  const signedOut = signedOutAll.slice(0, signedOutLimit)

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
        <h1 className="text-2xl font-bold">Contractor/Visitor details</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleRefresh} disabled={refreshing} className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300">
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={exportAllTables} className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800">
            Export all tables (CSV)
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 mb-2">{error}</p>}

      <Summary items={items} />

      {/* Awaiting confirmation (green highlight) */}
      <div className="bg-white border rounded mb-6">
        <div className="px-4 py-2 border-b bg-slate-50 font-semibold">Awaiting confirmation</div>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th><Th>Company</Th><Th>Phone</Th><Th>Areas</Th><Th>Signed in</Th><Th>Fob #</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {awaiting.length === 0 && (
              <tr><Td colSpan={7} className="text-center text-slate-500">None</Td></tr>
            )}
            {awaiting.map(i => (
              <AwaitingRow key={i.id} item={i} onConfirm={confirmSignIn} />
            ))}
          </tbody>
        </Table>
      </div>

      {/* On site (red highlight if signout requested) */}
      <div className="bg-white border rounded mb-6">
        <div className="px-4 py-2 border-b bg-slate-50 font-semibold">On site</div>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th><Th>Company</Th><Th>Phone</Th><Th>Areas</Th><Th>Signed in</Th><Th>Fob #</Th><Th>Signed in by</Th>
              <Th>Fob returned</Th><Th>Sign-out requested</Th><Th></Th>{isAdmin && <Th></Th>}
            </tr>
          </thead>
          <tbody>
            {onSite.length === 0 && (
              <tr><Td colSpan={isAdmin ? 11 : 10} className="text-center text-slate-500">None</Td></tr>
            )}

            {onSite.map(i => {
              const canSignOut = canConfirmSignOut(i)
              const reason = signOutDisabledReason(i)
              const fobIssued = hasFobIssued(i)

              const rowTone = i.signout_requested
                ? 'bg-rose-50/70'
                : ''

              return (
                <tr key={i.id} className={`border-t ${rowTone}`}>
                  <Td className={i.signout_requested ? 'text-rose-900 font-semibold' : ''}>
                    {i.first_name} {i.surname}
                  </Td>
                  <Td className={i.signout_requested ? 'text-rose-900/90' : ''}>{i.company}</Td>
                  <Td className={i.signout_requested ? 'text-rose-900/90' : ''}>{i.phone}</Td>
                  <Td className={i.signout_requested ? 'text-rose-900/90' : ''}>{(i.areas || []).join(', ')}</Td>
                  <Td className={i.signout_requested ? 'text-rose-900/90' : ''}>{formatDate(i.signed_in_at)}</Td>
                  <Td className={i.signout_requested ? 'text-rose-900/90' : ''}>{i.fob_number || <span className="text-slate-400">-</span>}</Td>
                  <Td className={i.signout_requested ? 'text-rose-900/90' : ''}>{shortEmail(i.sign_in_confirmed_by_email) || <span className="text-slate-400">-</span>}</Td>

                  {/* Fob returned checkbox logic */}
                  <Td>
                    <input
                      type="checkbox"
                      checked={!!i.fob_returned}
                      disabled={!fobIssued}
                      title={!fobIssued ? 'No fob issued' : 'Fob returned'}
                      onChange={e => setFobReturned(i.id, e.target.checked)}
                      className={!fobIssued ? 'cursor-not-allowed opacity-60' : ''}
                    />
                  </Td>

                  <Td className={i.signout_requested ? 'text-rose-900 font-semibold' : ''}>
                    {i.signout_requested ? 'Yes' : 'No'}
                  </Td>

                  <Td>
                    <button
                      disabled={!canSignOut}
                      title={!canSignOut ? reason : 'Confirm sign-out'}
                      onClick={() => confirmSignOut(i)}
                      className={`px-3 py-1 rounded whitespace-nowrap text-sm ${
                        canSignOut
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      }`}
                      style={{ fontSize: '0.80rem' }}
                    >
                      Confirm sign-out
                    </button>
                  </Td>

                  {isAdmin && (
                    <Td>
                      <button onClick={() => remove(i.id)} className="px-2 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded">
                        Delete
                      </button>
                    </Td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </Table>
      </div>

      {/* Signed out table unchanged */}
      <div className="bg-white border rounded">
        <div className="px-4 py-2 border-b bg-slate-50 font-semibold flex items-center justify-between">
          <span>Signed out (last {signedOutLimit})</span>
          <div className="flex gap-2">
            {signedOutLimit === 10 && signedOutAll.length > 10 && (
              <button onClick={() => setSignedOutLimit(30)} className="px-3 py-1 text-sm bg-slate-900 text-white rounded hover:bg-slate-800">
                Show more
              </button>
            )}
            {signedOutLimit === 30 && (
              <button onClick={() => setSignedOutLimit(10)} className="px-3 py-1 text-sm bg-slate-200 rounded hover:bg-slate-300">
                Show less
              </button>
            )}
          </div>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th><Th>Company</Th><Th>Phone</Th><Th>Areas</Th><Th>Fob #</Th><Th>Fob returned</Th>
              <Th>Signed in</Th><Th>Signed out</Th><Th>Signed in by</Th><Th>Signed out by</Th>
            </tr>
          </thead>
          <tbody>
            {signedOut.length === 0 && (
              <tr><Td colSpan={10} className="text-center text-slate-500">None</Td></tr>
            )}
            {signedOut.map(i => (
              <tr key={i.id} className="border-t">
                <Td>{i.first_name} {i.surname}</Td>
                <Td>{i.company}</Td>
                <Td>{i.phone}</Td>
                <Td>{(i.areas || []).join(', ')}</Td>
                <Td>{i.fob_number || <span className="text-slate-400">-</span>}</Td>
                <Td>{i.fob_returned ? 'Yes' : 'No'}</Td>
                <Td>{formatDate(i.signed_in_at)}</Td>
                <Td>{formatDate(i.signed_out_at)}</Td>
                <Td>{shortEmail(i.sign_in_confirmed_by_email) || <span className="text-slate-400">-</span>}</Td>
                <Td>{shortEmail(i.signed_out_by_email) || <span className="text-slate-400">-</span>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <p className="text-xs text-slate-500 mt-3">
        Signed-out records are kept for up to 7 days and then automatically removed.
      </p>
    </section>
  )
}
