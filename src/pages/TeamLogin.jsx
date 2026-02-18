import React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function TeamLogin() {
  const navigate = useNavigate()
  const [mode, setMode] = React.useState('signin')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-4">Team leader {mode === 'signin' ? 'login' : 'sign up'}</h1>
      <div className="bg-white p-4 rounded border border-slate-200">
        <div className="flex gap-2 mb-4">
          <button onClick={()=>setMode('signin')} className={`px-3 py-1 rounded ${mode==='signin' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>Sign in</button>
          <button onClick={()=>setMode('signup')} className={`px-3 py-1 rounded ${mode==='signup' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>Sign up</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600">Email</label>
            <input className="mt-1 w-full border rounded p-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm text-slate-600">Password</label>
            <input className="mt-1 w-full border rounded p-2" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-red-600">{error}</p>}
          <button disabled={loading} className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50">
            {loading ? 'Please wait...' : (mode==='signin' ? 'Sign in' : 'Create account')}
          </button>
        </form>
      </div>
    </section>
  )
}
