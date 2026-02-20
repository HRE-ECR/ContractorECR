import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function NavBar() {
  const location = useLocation()
  const [session, setSession] = React.useState(null)
  const [role, setRole] = React.useState(null)

  React.useEffect(() => {
    let mounted = true

    async function syncFromSession() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      const sess = data.session || null
      setSession(sess)

      const r = sess?.user?.app_metadata?.app_role || null
      setRole(r)
    }

    syncFromSession()

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

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const isActive = (path) => location.pathname === path
  const linkBase = 'px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap'
  const linkClass = (path) =>
    `${linkBase} ${isActive(path) ? 'bg-slate-800 text-white' : 'text-slate-100 hover:bg-slate-700'}`

  const normalizedRole = (role || '').toLowerCase()
  const canDashboard = !!session && (normalizedRole === 'teamleader' || normalizedRole === 'admin')
  const canScreen = !!session && (normalizedRole === 'display' || normalizedRole === 'teamleader' || normalizedRole === 'admin')

  return (
    <nav className="bg-slate-900 text-white">
      {/* Hide scrollbar but keep swipe scrolling */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="font-semibold tracking-tight text-lg">
            ContractorECR
          </Link>

          {/* Mobile: one row + swipe left/right (no scrollbar). Desktop: normal */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap touch-pan-x sm:overflow-visible">
            <Link className={linkClass('/')} to="/">Home</Link>
            <Link className={linkClass('/sign-in')} to="/sign-in">Sign-in</Link>
            <Link className={linkClass('/sign-out')} to="/sign-out">Sign-out</Link>

            {canDashboard && (
              <Link className={linkClass('/dashboard')} to="/dashboard">Dashboard</Link>
            )}

            {canScreen && (
              <Link className={linkClass('/screen')} to="/screen">Screen display</Link>
            )}

            {session ? (
              <button
                onClick={handleSignOut}
                className="px-3 py-2 text-sm bg-red-600 hover:bg-red-700 rounded-md whitespace-nowrap"
              >
                Logout
              </button>
            ) : (
              <Link className={linkClass('/login')} to="/login">Team leader login</Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
