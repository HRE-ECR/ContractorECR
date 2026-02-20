import React from 'react'
import { Navigate, Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function ProtectedRoute({ children }) {
  const location = useLocation()

  const [loading, setLoading] = React.useState(true)
  const [session, setSession] = React.useState(null)
  const [role, setRole] = React.useState(null)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let mounted = true

    async function init() {
      setLoading(true)
      setError('')

      const { data } = await supabase.auth.getSession()
      const sess = data.session
      if (!mounted) return

      setSession(sess)

      if (!sess?.user?.id) {
        setLoading(false)
        return
      }

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', sess.user.id)
        .single()

      if (!mounted) return

      if (profErr) setError(profErr.message)
      setRole(prof?.role || null)
      setLoading(false)
    }

    init()
    return () => { mounted = false }
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    window.location.hash = '#/login'
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (!session) return <Navigate to="/login" />

  const normalizedRole = (role || '').toLowerCase()

  // Route-specific access rules
  const path = location.pathname || ''
  const isDashboardRoute = path.startsWith('/dashboard')
  const isScreenRoute = path.startsWith('/screen')

  // New teamleaders are never allowed into protected screens until approved
  if (normalizedRole === 'new_teamleader') {
    return (
      <div className="max-w-xl mx-auto bg-white border rounded p-5">
        <h1 className="text-xl font-bold mb-2">Account awaiting approval</h1>
        <p className="text-slate-700">Please contact Admin for team leader account approval.</p>
        {error && <p className="text-red-600 mt-3">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={logout} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Logout
          </button>
          <Link to="/" className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300">
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  // If role can't be read (null/empty), fail closed for protected routes
  if (!normalizedRole) {
    return (
      <div className="max-w-xl mx-auto bg-white border rounded p-5">
        <h1 className="text-xl font-bold mb-2">Access blocked</h1>
        <p className="text-slate-700">
          Your account role could not be verified. Please contact Admin.
        </p>
        {error && <p className="text-red-600 mt-3">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={logout} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Logout
          </button>
          <Link to="/" className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300">
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  // Dashboard: only teamleader/admin
  if (isDashboardRoute) {
    const ok = normalizedRole === 'teamleader' || normalizedRole === 'admin'
    if (!ok) {
      return (
        <div className="max-w-xl mx-auto bg-white border rounded p-5">
          <h1 className="text-xl font-bold mb-2">Access denied</h1>
          <p className="text-slate-700">
            Your account does not have permission to view the Dashboard.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Current role: <span className="font-mono">{role}</span>
          </p>
          {error && <p className="text-red-600 mt-3">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={logout} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
              Logout
            </button>
            <Link to="/" className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300">
              Back to Home
            </Link>
          </div>
        </div>
      )
    }
  }

  // Screen display: display/teamleader/admin
  if (isScreenRoute) {
    const ok = normalizedRole === 'display' || normalizedRole === 'teamleader' || normalizedRole === 'admin'
    if (!ok) {
      return (
        <div className="max-w-xl mx-auto bg-white border rounded p-5">
          <h1 className="text-xl font-bold mb-2">Access denied</h1>
          <p className="text-slate-700">
            Your account does not have permission to view Screen display.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Current role: <span className="font-mono">{role}</span>
          </p>
          {error && <p className="text-red-600 mt-3">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={logout} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
              Logout
            </button>
            <Link to="/" className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300">
              Back to Home
            </Link>
          </div>
        </div>
      )
    }
  }

  return children
}
