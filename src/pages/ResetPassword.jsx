import React from 'react'
import { supabase } from '../supabaseClient'

export default function ResetPassword() {
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    supabase.auth.getSession()
  }, [])

  async function handleUpdatePassword(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      setError(err.message)
      return
    }

    setMessage('Password updated successfully. You can now log in.')
  }

  return (
    <section className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Reset password</h1>

      <form onSubmit={handleUpdatePassword} className="space-y-4 bg-white p-4 rounded border border-slate-200">
        <div>
          <label className="block text-sm text-slate-600">New password</label>
          <input className="mt-1 w-full border rounded p-2" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>

        <div>
          <label className="block text-sm text-slate-600">Confirm new password</label>
          <input className="mt-1 w-full border rounded p-2" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        </div>

        {error && <p className="text-red-600">{error}</p>}
        {message && <p className="text-green-700">{message}</p>}

        <button disabled={loading} className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50">
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </section>
  )
}
