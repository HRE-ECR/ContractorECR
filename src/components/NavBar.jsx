import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function NavBar() {
  const location = useLocation()
  const [user, setUser] = React.useState(null)

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const isActive = (path) => location.pathname === path
  const linkBase = 'px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap'
  const linkClass = (path) =>
    `${linkBase} ${isActive(path) ? 'bg-slate-800 text-white' : 'text-slate-100 hover:bg-slate-700'}`

  return (
    <nav className="bg-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="font-semibold tracking-tight text-lg">ContractorECR</Link>

          <div className="flex flex-wrap items-center gap-2">
            <Link className={linkClass('/')} to="/">Home</Link>
            <Link className={linkClass('/sign-in')} to="/sign-in">Sign-in</Link>
            <Link className={linkClass('/sign-out')} to="/sign-out">Sign-out</Link>

            {user && (
              <Link className={linkClass('/dashboard')} to="/dashboard">Dashboard</Link>
            )}

            {user ? (
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
