import React from 'react'
import { supabase } from '../supabaseClient'

export default function SignOut() {
  const [first_name, setFirst] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')

  // ✅ Modal state (added only)
  const [showSignOutModal, setShowSignOutModal] = React.useState(false)
  const acknowledgeRef = React.useRef(null)

  // ✅ Block background scroll while modal is open + focus button
  React.useEffect(() => {
    if (!showSignOutModal) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const t = setTimeout(() => acknowledgeRef.current?.focus(), 0)

    return () => {
      clearTimeout(t)
      document.body.style.overflow = prevOverflow
    }
  }, [showSignOutModal])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!first_name || !phone) {
      setError('Please enter your first name and phone number.')
      return
    }

    setLoading(true)
    const { data, error: err } = await supabase.rpc('request_signout', {
      p_first: first_name.trim(),
      p_phone: phone.trim(),
    })
    setLoading(false)

    if (err) setError(err.message)
    else if (!data) setMessage('No active sign-in found for those details.')
    else {
      setMessage('Sign-out request submitted. A Team Leader will confirm shortly.')
      // ✅ Show modal ONLY on successful sign-out request
      setShowSignOutModal(true)
    }

    setFirst('')
    setPhone('')
  }

  return (
    <section className="max-w-md mx-auto">
      {/* ✅ Sign-out success modal (added only; does not change page layout) */}
      {showSignOutModal && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signout-success-title"
          // Block click-through; does NOT close on background click
          onMouseDown={e => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            {/* Red header */}
            <div className="px-5 py-4 bg-red-50 border-b border-slate-200">
              <h2
                id="signout-success-title"
                className="text-lg font-bold text-slate-900 flex items-center gap-2"
              >
                <span aria-hidden="true">➜🚪</span>
                Sign out registered
              </h2>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-slate-800 leading-relaxed">
                ➜🚪 <span className="font-semibold">Sign out registered</span>, please see a team leader
                before departing site.
              </p>

              <div className="flex gap-3 rounded-lg bg-amber-50 border border-amber-200 p-4">
                <div className="text-lg leading-none" aria-hidden="true">
                  ⚠️
                </div>
                <p className="text-slate-800 leading-relaxed">
                  Please ensure you have logged off <strong>Depot Protection System</strong> and{' '}
                  <strong>Overhead Isolation</strong>. Hand back any <strong>Fobs</strong> or <strong>Padlocks</strong> issued{' '}
                  <span aria-hidden="true">⚠️</span>
                </p>
              </div>

              <div className="flex gap-3 rounded-lg bg-slate-50 border border-slate-200 p-4">
                <div className="text-lg leading-none" aria-hidden="true">
                  ℹ️
                </div>
                <p className="text-slate-700 leading-relaxed">
                  <span className="font-semibold">Any questions or concerns</span> please contact the
                  on duty manager or a team leader.
                </p>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end">
              <button
                ref={acknowledgeRef}
                type="button"
                className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-sky-200"
                onClick={() => setShowSignOutModal(false)}
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Your existing sign-out page below (unchanged) */}
      <h1 className="text-2xl font-bold mb-4">Contractor/Visitor sign-out</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded border border-slate-200">
        <div>
          <label className="block text-sm text-slate-600">First name</label>
          <input
            className="mt-1 w-full border rounded p-2"
            value={first_name}
            onChange={e => setFirst(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600">Phone number</label>
          <input
            className="mt-1 w-full border rounded p-2"
            inputMode="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-red-600">{error}</p>}
        {message && <p className="text-green-700">{message}</p>}

        <button
          disabled={loading}
          className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit sign-out request'}
        </button>
      </form>
    </section>
  )
}
