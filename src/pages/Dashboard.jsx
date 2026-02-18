import React from 'react'
import { supabase } from '../supabaseClient'

const AREAS = ['M1', 'M2', 'Insp', '1CL', '2CL', '3CL', '4CL']

// Avoid writing '\n' directly in strings (some editors/Teams can inject real line breaks)
const NL = String.fromCharCode(10)

function Summary({ items }) {
  const onSite = items.filter(i => i.status !== 'signed_out' && !i.signed_out_at)
  const total = onSite.length

  const perArea = {}
  AREAS.forEach(a => { perArea[a] = 0 })

  onSite.forEach(i => {
    const areas = i.areas || []
    areas.forEach(a => {
      if (perArea[a] !== undefined) perArea[a] += 1
    })
  })

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <div className="p-3 bg-white border rounded">
        <div className="text-xs text-slate-500">Total on site</div>
        <div className="text-2xl font-semibold">{total}</div>
      </div>

      {AREAS.map(a => (
        <div key={a} className="p-3 bg-white border rounded">
          <div className="text-xs text-slate-500">{a}</div>
          <div className="text-xl font-semibold">{perArea[a]}</div>
        </div>
      ))}
    </div>
  )
}

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

  // No regex here (prevents regex literal line-split build failures)
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
    <tr className="border-t">
      <Td>{item.first_name} {item.surname}</Td>
      <Td>{item.company}</Td>
      <Td>{item.phone}</Td>
      <Td>{(item.areas || []).join(', ')}</Td>
      <Td>{formatDate(item.signed_in_at)}</Td>
      <Td>
        <input
          className="border rounded p-1 w-32"
          placeholder="Enter fob #"
          value={fob}
          onChange={e => setFob(e.target.value)}
        />
      </Td>
      <Td>
        {/* GREEN button */}
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
    ;(async () => {
      setLoading(true)
      await load()
      setLoading(false)
    })()
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function confirmSignIn(itemId, fob) {
    if (!fob) return alert('Fob number is required')

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id || null
    const email = userData.user?.email || null

    const { error } = await supabase
      .from('contractors')
      .update({
        fob_number: fob,
        status: 'confirmed',
        sign_in_confirmed_at: new Date().toISOString(),
        sign_in_confirmed_by: uid,
        sign_in_confirmed_by_email: email,
      })
      .eq('id', itemId)

    if (error) alert(error.message)
    else load()
  }

  async function confirmSignOut(itemId) {
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
      .eq('id', itemId)

    if (error) alert(error.message)
    else load()
  }

  // ✅ Fix: checkbox updates instantly (optimistic UI), and reverts on error
  async function setFobReturned(itemId, value) {
    const prevItems = items

    // optimistic update
    setItems(curr =>
      curr.map(i => (i.id === itemId ? { ...i, fob_returned: value } : i))
    )

    const { error } = await supabase
      .from('contractors')
      .update({ fob_returned: value })
      .eq('id', itemId)

    if (error) {
      // revert
      setItems(prevItems)
      alert(error.message)
    }
  }

  async function remove(itemId) {
    if (!isAdmin) return
    if (!confirm('Delete this record? This cannot be undone.')) return

    const { error } = await supabase
      .from('contractors')
      .delete()
      .eq('id', itemId)

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
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            onClick={exportAllTables}
            className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800"
          >
            Export all tables (CSV)
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 mb-2">{error}</p>}
      <Summary items={items} />

      {/* Awaiting confirmation */}
      <div className="bg-white border rounded mb-6">
        <div className="px-4 py-2 border-b bg-slate-50 font-semibold">Awaiting confirmation</div>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Company</Th>
              <Th>Phone</Th>
              <Th>Areas</Th>
              <Th>Signed in</Th>
              <Th>Fob #</Th>
              <Th></Th>
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

      {/* On site (NOW includes Signed in datetime) */}
      <div className="bg-white border rounded mb-6">
        <div className="px-4 py-2 border-b bg-slate-50 font-semibold">On site</div>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Company</Th>
              <Th>Phone</Th>
              <Th>Areas</Th>
              <Th>Signed in</Th>
              <Th>Fob #</Th>
              <Th>Signed in by</Th>
              <Th>Fob returned</Th>
              <Th>Sign-out requested</Th>
              <Th></Th>
              {isAdmin && <Th></Th>}
            </tr>
          </thead>
          <tbody>
            {onSite.length === 0 && (
              <tr><Td colSpan={isAdmin ? 11 : 10} className="text-center text-slate-500">None</Td></tr>
            )}

            {onSite.map(i => (
              <tr key={i.id} className="border-t">
                <Td>{i.first_name} {i.surname}</Td>
                <Td>{i.company}</Td>
                <Td>{i.phone}</Td>
                <Td>{(i.areas || []).join(', ')}</Td>
                <Td>{formatDate(i.signed_in_at)}</Td>
                <Td>{i.fob_number || <span className="text-slate-400">-</span>}</Td>
                <Td>{shortEmail(i.sign_in_confirmed_by_email) || <span className="text-slate-400">-</span>}</Td>
                <Td>
                  <input
                    type="checkbox"
                    checked={!!i.fob_returned}
                    onChange={e => setFobReturned(i.id, e.target.checked)}
                  />
                </Td>
                <Td>{i.signout_requested ? 'Yes' : 'No'}</Td>
                <Td>
                  <button
                    disabled={!i.fob_returned}
                    onClick={() => confirmSignOut(i.id)}
                    className={`px-3 py-1 rounded ${
                      i.fob_returned
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    Confirm sign-out
                  </button>
                </Td>
                {isAdmin && (
                  <Td>
                    <button
                      onClick={() => remove(i.id)}
                      className="px-2 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
                    >
                      Delete
                    </button>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Signed out */}
      <div className="bg-white border rounded">
        <div className="px-4 py-2 border-b bg-slate-50 font-semibold flex items-center justify-between">
          <span>Signed out (last {signedOutLimit})</span>
          <div className="flex gap-2">
            {signedOutLimit === 10 && signedOutAll.length > 10 && (
              <button
                onClick={() => setSignedOutLimit(30)}
                className="px-3 py-1 text-sm bg-slate-900 text-white rounded hover:bg-slate-800"
              >
                Show more
              </button>
            )}
            {signedOutLimit === 30 && (
              <button
                onClick={() => setSignedOutLimit(10)}
                className="px-3 py-1 text-sm bg-slate-200 rounded hover:bg-slate-300"
              >
                Show less
              </button>
            )}
          </div>
        </div>

        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Company</Th>
              <Th>Phone</Th>
              <Th>Areas</Th>
              <Th>Fob #</Th>
              <Th>Fob returned</Th>
              <Th>Signed in</Th>
              <Th>Signed out</Th>
              <Th>Signed in by</Th>
              <Th>Signed out by</Th>
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
