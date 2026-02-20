import React from 'react'
import { Navigate, Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const [loading, setLoading] = React.useState(true)
  const [session, setSession] = React.useState(null)
  const [role, setRole] = React.useState(null)

  React.useEffect(() => {
    let mounted = true

    async function init() {
      setLoading(true)
      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      const sess = data.session || null
      setSession(sess)
      setRole(sess?.user?.app_metadata?.app_role || null)
      setLoading(false)
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!mounted) return
      setSession(sess || null)
      setRole(sess?.user?.app_metadata?.app_role || null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    window.location.hash = '#/login'
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (!session) return <Navigate to="/login" />

  const normalizedRole = (role || '').toLowerCase()
  const path = location.pathname || ''
  const isDashboardRoute = path.startsWith('/dashboard')
  const isScreenRoute = path.startsWith('/screen')

  // Awaiting approval
  if (normalizedRole === 'new_teamleader') {
    return (
      <div className="max-w-xl mx-auto bg-white border rounded p-5">
        <h1 className="text-xl font-bold mb-2">Account awaiting approval</h1>
        <p className="text-slate-700">Please contact Admin for team leader account approval.</p>
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

  // Fail closed if claim missing
  if (!normalizedRole) {
    return (
      <div className="max-w-xl mx-auto bg-white border rounded p-5">
        <h1 className="text-xl font-bold mb-2">Access blocked</h1>
        <p className="text-slate-700">
          Your account role could not be verified. Please log out and back in. If it persists, contact Admin.
        </p>
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

  // /dashboard only for teamleader/admin
  if (isDashboardRoute) {
    const ok = normalizedRole === 'teamleader' || normalizedRole === 'admin'
    if (!ok) {
      return (
        <div className="max-w-xl mx-auto bg-white border rounded p-5">
          <h1 className="text-xl font-bold mb-2">Access denied</h1>
          <p className="text-slate-700">You do not have permission to view the Dashboard.</p>
          <p className="text-xs text-slate-500 mt-2">
            Current role: <span className="font-mono">{role}</span>
          </p>
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

  // /screen for display/teamleader/admin
  if (isScreenRoute) {
    const ok = normalizedRole === 'display' || normalizedRole === 'teamleader' || normalizedRole === 'admin'
    if (!ok) {
      return (
        <div className="max-w-xl mx-auto bg-white border rounded p-5">
          <h1 className="text-xl font-bold mb-2">Access denied</h1>
          <p className="text-slate-700">You do not have permission to view Screen display.</p>
          <p className="text-xs text-slate-500 mt-2">
            Current role: <span className="font-mono">{role}</span>
          </p>
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
