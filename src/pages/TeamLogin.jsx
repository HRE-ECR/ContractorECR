import React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function TeamLogin() {
  const navigate = useNavigate()
  const [mode, setMode] = React.useState('signin') // signin | signup | forgot
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [message, setMessage] = React.useState('')

  function getResetRedirectUrl() {
    return window.location.origin + window.location.pathname + '#/reset-password'
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/dashboard')
      }

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        navigate('/dashboard')
      }

      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getResetRedirectUrl(),
        })
        if (error) throw error
        setMessage('Password reset email sent. Please check your inbox.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        {mode === 'signin' && 'Team leader login'}
        {mode === 'signup' && 'Team leader sign up'}
        {mode === 'forgot' && 'Forgotten password'}
      </h1>

      <div className="bg-white p-4 rounded border border-slate-200">
        <div className="flex flex-wrap gap-2 mb-4">
          <button type="button" onClick={() => setMode('signin')} className={`px-3 py-1 rounded ${mode === 'signin' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>Sign in</button>
          <button type="button" onClick={() => setMode('signup')} className={`px-3 py-1 rounded ${mode === 'signup' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>Sign up</button>
          <button type="button" onClick={() => setMode('forgot')} className={`px-3 py-1 rounded ${mode === 'forgot' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>Forgot password</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600">Email</label>
            <input className="mt-1 w-full border rounded p-2" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          {mode !== 'forgot' && (
            <div>
              <label className="block text-sm text-slate-600">Password</label>
              <input className="mt-1 w-full border rounded p-2" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
          )}

          {error && <p className="text-red-600">{error}</p>}
          {message && <p className="text-green-700">{message}</p>}

          <button disabled={loading} className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50">
            {loading ? 'Please wait...' : (mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset email')}
          </button>

          {mode === 'signup' && (
            <p className="text-xs text-slate-500 mt-2">New accounts require Admin approval before dashboard access.</p>
          )}
        </form>
      </div>
    </section>
  )
}
