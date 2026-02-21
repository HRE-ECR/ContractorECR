import React from 'react'
import { supabase } from '../supabaseClient'

const NL = String.fromCharCode(10)

// Standard areas
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

    if (hasOther) otherCount += 1
  })

  // Upgraded KPI Chips with modern styling
  const chip = (label, value, icon, tone) => {
    const tones = {
      slate: 'border-l-slate-500 text-slate-700 bg-white',
      blue: 'border-l-blue-500 text-blue-800 bg-white',
      green: 'border-l-emerald-500 text-emerald-800 bg-white',
      red: 'border-l-rose-500 text-rose-800 bg-white',
      amber: 'border-l-amber-500 text-amber-800 bg-white',
    }
    const cls = tones[tone] || tones.slate

    return (
      <div className={`flex items-center justify-between gap-3 px-4 py-3 shadow-sm rounded-r-xl border-y border-r border-l-4 border-slate-100 hover:shadow-md transition-shadow duration-200 ${cls}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg bg-slate-50 p-1.5 rounded-md" aria-hidden="true">{icon}</span>
          <span className="text-xs font-bold uppercase tracking-wide truncate opacity-80">{label}</span>
        </div>
        <span className="text-xl font-extrabold tabular-nums">{value}</span>
      </div>
    )
  }

  return (
    <div className="space-y-3 mb-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
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
      <p className="text-xs text-slate-400 font-medium">
        * “Other” counts contractors who selected any non-standard area.
      </p>
    </div>
  )
}

function formatDate(value) {
  if (!value) return ''
  try { return new Date(value).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) } catch { return String(value) }
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
    <div className="overflow-x-auto rounded-b-xl">
      <table className="min-w-full text-sm">{children}</table>
    </div>
  )
}

function Th({ children }) {
  return (
    <th className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50 px-5 py-3 border-b border-slate-200">
      {children}
    </th>
  )
}

function Td({ children, className = '', ...rest }) {
  return (
    <td {...rest} className={`px-5 py-3 align-middle border-b border-slate-100 ${className}`}>
      {children}
    </td>
  )
}

function AwaitingRow({ item, onConfirm }) {
  const [fob, setFob] = React.useState('')

  return (
    <tr className="bg-emerald-50/40 hover:bg-emerald-50 transition-colors">
      <Td className="font-semibold text-emerald-900">{item.first_name} {item.surname}</Td>
      <Td className="text-emerald-800">{item.company}</Td>
      <Td className="text-emerald-800">{item.phone}</Td>
      <Td className="text-emerald-800">
        <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-md">
          {(item.areas || []).join(', ')}
        </span>
      </Td>
      <Td className="text-emerald-800">{formatDate(item.signed_in_at)}</Td>
      <Td>
        <input
          className="border border-emerald-200 rounded-lg px-3 py-1.5 w-32 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
          placeholder="Enter fob #"
          value={fob}
          onChange={e => setFob(e.target.value)}
        />
      </Td>
      <Td>
        <button
          onClick={() => onConfirm(item.id, fob)}
          className="px-4 py-1.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 shadow-sm transition-colors"
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
  }, [])

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
    if (!finalFob) {
      const ok = confirm('No fob number entered. Confirm that no fob is required or being issued?')
      if (!ok) return
      finalFob = '' 
    }

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id || null
    const email = userData.user?.email || null

    const updatePayload = {
      status: 'confirmed',
      sign_in_confirmed_at: new Date().toISOString(),
      sign_in_confirmed_by: uid,
      sign_in_confirmed_by_email: email,
      fob_number: finalFob ? finalFob : null, 
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
    if (item && !hasFobIssued(item)) return

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

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-lg font-medium text-slate-500 animate-pulse">Loading Dashboard...</div>
    </div>
  )

  const awaiting = items.filter(i => i.status === 'pending' && !i.signed_out_at)
  const onSite = items.filter(i => i.status === 'confirmed' && !i.signed_out_at)

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const signedOutAll = items
    .filter(i => i.signed_out_at)
    .filter(i => new Date(i.signed_out_at).getTime() >= sevenDaysAgo)
    .sort((a, b) => new Date(b.signed_out_at).getTime() - new Date(a.signed_out_at).getTime())

  const signedOut = signedOutAll.slice(0, signedOutLimit)

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* --- Modern Hero Header with Image Fallback --- */}
        <div className="relative overflow-hidden rounded-2xl shadow-lg bg-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          {/* Fallback gradient behind the image */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-slate-900 z-0"></div>
          {/* Train image from web. Replace src with your own Hitachi asset if needed */}
          <img 
            src="https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=1200&q=80" 
            alt="Hitachi High Speed Train" 
            className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay z-0"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          
          <div className="relative z-10 p-6 sm:p-8 flex-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Hitachi Rail</h1>
            <p className="text-blue-200 mt-2 text-sm sm:text-base font-medium">Contractor & Visitor Management Dashboard</p>
          </div>
          
          <div className="relative z-10 p-6 sm:p-8 flex flex-wrap gap-3 sm:justify-end">
            <button 
              onClick={handleRefresh} 
              disabled={refreshing} 
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-all text-sm font-semibold border border-white/20 focus:ring-2 focus:ring-white/50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
            <button 
              onClick={exportAllTables} 
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-md transition-all text-sm font-semibold focus:ring-2 focus:ring-blue-400"
            >
              Export CSV
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm">
            <p className="font-medium">{error}</p>
          </div>
        )}

        <Summary items={items} />

        {/* Awaiting confirmation */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <h2 className="font-bold text-slate-800">Awaiting Confirmation</h2>
            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-semibold">{awaiting.length}</span>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th><Th>Company</Th><Th>Phone</Th><Th>Areas</Th><Th>Signed in</Th><Th>Fob #</Th><Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {awaiting.length === 0 && (
                <tr><Td colSpan={7} className="text-center text-slate-500 py-8 italic">No contractors awaiting confirmation.</Td></tr>
              )}
              {awaiting.map(i => (
                <AwaitingRow key={i.id} item={i} onConfirm={confirmSignIn} />
              ))}
            </tbody>
          </Table>
        </div>

        {/* On site */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
            <h2 className="font-bold text-slate-800">Currently On-Site</h2>
            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-semibold">{onSite.length}</span>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th><Th>Company</Th><Th>Phone</Th><Th>Areas</Th><Th>Signed in</Th><Th>Fob #</Th><Th>Signed in by</Th>
                <Th>Fob returned</Th><Th>Sign-out req.</Th><Th>Action</Th>{isAdmin && <Th>Admin</Th>}
              </tr>
            </thead>
            <tbody>
              {onSite.length === 0 && (
                <tr><Td colSpan={isAdmin ? 11 : 10} className="text-center text-slate-500 py-8 italic">No one is currently on site.</Td></tr>
              )}

              {onSite.map(i => {
                const canSignOut = canConfirmSignOut(i)
                const reason = signOutDisabledReason(i)
                const fobIssued = hasFobIssued(i)
                const rowTone = i.signout_requested ? 'bg-rose-50/50 hover:bg-rose-50' : 'hover:bg-slate-50 transition-colors'

                return (
                  <tr key={i.id} className={rowTone}>
                    <Td className={i.signout_requested ? 'text-rose-900 font-semibold' : 'font-medium text-slate-900'}>
                      {i.first_name} {i.surname}
                    </Td>
                    <Td className={i.signout_requested ? 'text-rose-900/90' : 'text-slate-600'}>{i.company}</Td>
                    <Td className={i.signout_requested ? 'text-rose-900/90' : 'text-slate-600'}>{i.phone}</Td>
                    <Td>
                      <span className={`text-xs px-2 py-1 rounded-md ${i.signout_requested ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>
                        {(i.areas || []).join(', ')}
                      </span>
                    </Td>
                    <Td className={i.signout_requested ? 'text-rose-900/90' : 'text-slate-600'}>{formatDate(i.signed_in_at)}</Td>
                    <Td className={i.signout_requested ? 'text-rose-900/90' : 'text-slate-600 font-mono'}>{i.fob_number || <span className="text-slate-300">-</span>}</Td>
                    <Td className={i.signout_requested ? 'text-rose-900/90' : 'text-slate-600'}>{shortEmail(i.sign_in_confirmed_by_email) || <span className="text-slate-300">-</span>}</Td>

                    <Td>
                      <input
                        type="checkbox"
                        checked={!!i.fob_returned}
                        disabled={!fobIssued}
                        title={!fobIssued ? 'No fob issued' : 'Fob returned'}
                        onChange={e => setFobReturned(i.id, e.target.checked)}
                        className={`w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ${!fobIssued ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                      />
                    </Td>

                    <Td>
                      {i.signout_requested ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                          Yes
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">No</span>
                      )}
                    </Td>

                    <Td>
                      <button
                        disabled={!canSignOut}
                        title={!canSignOut ? reason : 'Confirm sign-out'}
                        onClick={() => confirmSignOut(i)}
                        className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-xs font-semibold transition-colors ${
                          canSignOut
                            ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                        }`}
                      >
                        Confirm out
                      </button>
                    </Td>

                    {isAdmin && (
                      <Td>
                        <button onClick={() => remove(i.id)} className="px-3 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors">
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

        {/* Signed out history */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-400"></span>
              <h2 className="font-bold text-slate-800">Signed Out <span className="text-slate-500 font-normal text-sm ml-1">(Last {signedOutLimit})</span></h2>
            </div>
            <div className="flex gap-2">
              {signedOutLimit === 10 && signedOutAll.length > 10 && (
                <button onClick={() => setSignedOutLimit(30)} className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                  Load More
                </button>
              )}
              {signedOutLimit === 30 && (
                <button onClick={() => setSignedOutLimit(10)} className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                  Show Less
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
                <tr><Td colSpan={10} className="text-center text-slate-500 py-8 italic">No recent sign-outs.</Td></tr>
              )}
              {signedOut.map(i => (
                <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                  <Td className="font-medium text-slate-900">{i.first_name} {i.surname}</Td>
                  <Td className="text-slate-600">{i.company}</Td>
                  <Td className="text-slate-600">{i.phone}</Td>
                  <Td>
                     <span className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-md">
                      {(i.areas || []).join(', ')}
                    </span>
                  </Td>
                  <Td className="text-slate-600 font-mono">{i.fob_number || <span className="text-slate-300">-</span>}</Td>
                  <Td>{i.fob_returned ? <span className="text-emerald-600 font-medium text-sm">Yes</span> : <span className="text-slate-400 text-sm">No</span>}</Td>
                  <Td className="text-slate-500 text-sm">{formatDate(i.signed_in_at)}</Td>
                  <Td className="text-slate-500 text-sm">{formatDate(i.signed_out_at)}</Td>
                  <Td className="text-slate-500 text-sm">{shortEmail(i.sign_in_confirmed_by_email) || <span className="text-slate-300">-</span>}</Td>
                  <Td className="text-slate-500 text-sm">{shortEmail(i.signed_out_by_email) || <span className="text-slate-300">-</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <p className="text-xs text-slate-400 mt-4 text-center">
          Signed-out records are kept for up to 7 days and then automatically removed.
        </p>
      </div>
    </div>
  )
}
