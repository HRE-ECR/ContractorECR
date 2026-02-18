
import React from 'react'
import { supabase } from '../supabaseClient'

const AREAS = ['M1','M2','Insp','1CL','2CL','3CL','4CL']

function Summary({ items }) {
  const onSite = items.filter(i => i.status !== 'signed_out' && !i.signed_out_at)
  const total = onSite.length
  const perArea = {}
  AREAS.forEach(a => { perArea[a] = 0 })
  onSite.forEach(i => {
    (i.areas || []).forEach(a => { if (perArea[a] !== undefined) perArea[a]++ })
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

export default function Dashboard() {
  const [items, setItems] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [error, setError] = React.useState('')

  async function load() {
    setLoading(true)
    setError('')
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id

    // Fetch role
    let admin = false
    if (uid) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', uid).single()
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
    setLoading(false)
  }

  React.useEffect(() => { load() }, [])

  async function confirmSignIn(itemId, fob) {
    if (!fob) return alert('Fob number is required')
    const { error } = await supabase.from('contractors').update({
      fob_number: fob,
      status: 'confirmed',
      sign_in_confirmed_at: new Date().toISOString()
    }).eq('id', itemId)
    if (error) alert(error.message); else load()
  }

  async function confirmSignOut(itemId) {
    const { error } = await supabase.from('contractors').update({
      status: 'signed_out',
      signed_out_at: new Date().toISOString()
    }).eq('id', itemId)
    if (error) alert(error.message); else load()
  }

  async function setFobReturned(itemId, value) {
    const { error } = await supabase.from('contractors').update({ fob_returned: value }).eq('id', itemId)
    if (error) alert(error.message)
  }

  async function remove(itemId) {
    if (!isAdmin) return
    if (!confirm('Delete this record? This cannot be undone.')) return
    const { error } = await supabase.from('contractors').delete().eq('id', itemId)
    if (error) alert(error.message); else load()
  }

  if (loading) return <div className="p-6">Loading…</div>

  const awaiting = items.filter(i => i.status === 'pending' && !i.signed_out_at)
  const active = items.filter(i => i.status === 'confirmed' && !i.signed_out_at)

  return (
    <section>
      <h1 className="text-2xl font-bold mb-2">Contractor/Visitor details</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <Summary items={items} />

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
            {awaiting.length === 0 && <tr><Td colSpan={7} className="text-center text-slate-500">None</Td></tr>}
            {awaiting.map(i => <AwaitingRow key={i.id} item={i} onConfirm={confirmSignIn} />)}
          </tbody>
        </Table>
      </div>

      <div className="bg-white border rounded">
        <div className="px-4 py-2 border-b bg-slate-50 font-semibold">On site</div>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Company</Th>
              <Th>Phone</Th>
              <Th>Areas</Th>
              <Th>Fob returned</Th>
              <Th>Sign-out requested</Th>
              <Th></Th>
              {isAdmin && <Th></Th>}
            </tr>
          </thead>
          <tbody>
            {active.length === 0 && <tr><Td colSpan={isAdmin?8:7} className="text-center text-slate-500">None</Td></tr>}
            {active.map(i => (
              <tr key={i.id} className="border-t">
                <Td>{i.first_name} {i.surname}</Td>
                <Td>{i.company}</Td>
                <Td>{i.phone}</Td>
                <Td>{(i.areas||[]).join(', ')}</Td>
                <Td>
                  <input type="checkbox" checked={!!i.fob_returned} onChange={e=>setFobReturned(i.id, e.target.checked)} />
                </Td>
                <Td>{i.signout_requested ? 'Yes' : 'No'}</Td>
                <Td>
                  <button
                    disabled={!i.fob_returned}
                    onClick={()=>confirmSignOut(i.id)}
                    className={`px-3 py-1 rounded ${i.fob_returned ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                  >Confirm sign-out</button>
                </Td>
                {isAdmin && <Td><button onClick={()=>remove(i.id)} className="px-2 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded">Delete</button></Td>}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </section>
  )
}

function Table({ children }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">{children}</table>
    </div>
  )
}
function Th({ children }) { return <th className="text-left text-xs uppercase tracking-wider text-slate-500 px-4 py-2">{children}</th> }
function Td({ children, className='', ...rest }) { return <td {...rest} className={`px-4 py-2 align-middle ${className}`}>{children}</td> }

function AwaitingRow({ item, onConfirm }) {
  const [fob, setFob] = React.useState('')
  return (
    <tr className="border-t">
      <Td>{item.first_name} {item.surname}</Td>
      <Td>{item.company}</Td>
      <Td>{item.phone}</Td>
      <Td>{(item.areas||[]).join(', ')}</Td>
      <Td>{new Date(item.signed_in_at).toLocaleString()}</Td>
      <Td>
        <input className="border rounded p-1 w-32" placeholder="Enter fob #" value={fob} onChange={e=>setFob(e.target.value)} />
      </Td>
      <Td>
        <button onClick={()=>onConfirm(item.id, fob)} className="px-3 py-1 bg-slate-900 text-white rounded hover:bg-slate-800">Confirm sign-in</button>
      </Td>
    </tr>
  )
}
