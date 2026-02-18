import React from 'react'
import { supabase } from '../supabaseClient'

export default function SignOut() {
  const [first_name, setFirst] = React.useState('')
  const [phone, setPhone] = React.useState('')
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

  async function logoutNow() {
    await supabase.auth.signOut()
    setSessionUser(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!first_name || !phone) {
      setError('Please enter your first name and phone number.')
      return
    }

    setLoading(true)
    const { data, error: err } = await supabase.rpc('request_signout', { p_first: first_name.trim(), p_phone: phone.trim() })
    setLoading(false)

    if (err) setError(err.message)
    else if (!data) setMessage('No active sign-in found for those details.')
    else setMessage('Sign-out request submitted. A Team Leader will confirm shortly.')

    setFirst('')
    setPhone('')
  }

  return (
    <section className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Contractor/Visitor sign-out</h1>

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
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded border border-slate-200">
        <div>
          <label className="block text-sm text-slate-600">First name</label>
          <input className="mt-1 w-full border rounded p-2" value={first_name} onChange={e => setFirst(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm text-slate-600">Phone number</label>
          <input className="mt-1 w-full border rounded p-2" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} required />
        </div>

        {error && <p className="text-red-600">{error}</p>}
        {message && <p className="text-green-700">{message}</p>}

        <button disabled={loading} className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50">
          {loading ? 'Submitting...' : 'Submit sign-out request'}
        </button>
      </form>
    </section>
  )
}
