import React from 'react'
import { supabase } from '../supabaseClient'

const AREAS = ['M1','M2','Insp','1CL','2CL','3CL','4CL']

export default function SignIn() {
  const [form, setForm] = React.useState({ first_name: '', surname: '', company: '', phone: '', areas: [] })
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')

  const [sessionUser, setSessionUser] = React.useState(null)

  React.useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSessionUser(data?.session?.user || null)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSessionUser(sess?.user || null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  function toggleArea(a) {
    setForm((f) => {
      const exists = f.areas.includes(a)
      return { ...f, areas: exists ? f.areas.filter(x => x !== a) : [...f.areas, a] }
    })
  }

  async function logoutNow() {
    await supabase.auth.signOut()
    setSessionUser(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!form.first_name || !form.surname || !form.company || !form.phone || form.areas.length === 0) {
      setError('All fields are mandatory and at least one Area of work must be selected.')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.from('contractors').insert({
      first_name: form.first_name.trim(),
      surname: form.surname.trim(),
      company: form.company.trim(),
      phone: form.phone.trim(),
      areas: form.areas,
      status: 'pending'
    })
    setLoading(false)

    if (err) setError(err.message)
    else {
      setMessage('Signed-in request recorded. Please see a Team Leader to receive a visitor fob.')
      setForm({ first_name: '', surname: '', company: '', phone: '', areas: [] })
    }
  }

  return (
    <section className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Contractor/Visitor sign-in</h1>

      {sessionUser && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <div className="font-semibold">You are currently logged in as a Team Leader</div>
          <div className="text-sm mt-1">
            This page is intended for contractors/visitors using their own phones. You can continue, or log out first.
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={logoutNow} className="px-3 py-2 rounded bg-amber-700 text-white hover:bg-amber-800">
              Logout
            </button>
            <span className="text-xs self-center opacity-80">(Shown only to prevent confusion during testing.)</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-600">First name</label>
            <input className="mt-1 w-full border rounded p-2" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm text-slate-600">Surname</label>
            <input className="mt-1 w-full border rounded p-2" value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm text-slate-600">Company</label>
            <input className="mt-1 w-full border rounded p-2" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm text-slate-600">Phone number</label>
            <input className="mt-1 w-full border rounded p-2" inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Area of work (select one or more)</label>
          <div className="grid grid-cols-3 gap-2">
            {AREAS.map(a => (
              <label key={a} className={`flex items-center gap-2 border rounded p-2 ${form.areas.includes(a) ? 'bg-slate-100 border-slate-400' : 'border-slate-200'}`}>
                <input type="checkbox" checked={form.areas.includes(a)} onChange={() => toggleArea(a)} /> {a}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-red-600">{error}</p>}
        {message && <p className="text-green-700">{message}</p>}

        <button disabled={loading} className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50">
          {loading ? 'Submitting...' : 'Sign-in'}
        </button>
      </form>
    </section>
  )
}
