import React from 'react'
import { supabase } from '../supabaseClient'

const AREAS = [
  'Maint-1',
  'Maint-2',
  'Insp-shed',
  'Rep-Shed',
  '1-Clean',
  '2-Clean',
  '3-Clean',
  '4-Clean',
]

// --- Cooldown cookie settings ---
const SIGNIN_COOLDOWN_SECONDS = 120
const SIGNIN_COOLDOWN_COOKIE = 'cvc_signin_cooldown_until'

// Basic cookie helpers (SameSite=Lax is a sensible default for this use)
function getCookie(name) {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : ''
}

function setCookie(name, value, maxAgeSeconds) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`
}

function formatRemaining(totalSeconds) {
  const s = Math.max(0, Number(totalSeconds) || 0)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export default function SignIn() {
  const [form, setForm] = React.useState({
    first_name: '',
    surname: '',
    company: '',
    phone: '',
    areas: [],
  })

  // "Other" textbox behaviour:
  // - shows "Other" text in the box initially
  // - clears on focus
  // - restores on blur if left empty
  const [otherArea, setOtherArea] = React.useState('Other')

  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')

  // ✅ Modal: only new state/logic (does not affect page styling/layout)
  const [showSuccessModal, setShowSuccessModal] = React.useState(false)
  const acknowledgeRef = React.useRef(null)

  // --- Cooldown state (cookie-driven) ---
  const [cooldownUntil, setCooldownUntil] = React.useState(0)
  const [tick, setTick] = React.useState(Date.now())

  // Load cooldown from cookie on mount + keep a 1s tick for countdown UI
  React.useEffect(() => {
    const raw = getCookie(SIGNIN_COOLDOWN_COOKIE)
    const until = Number(raw || 0)
    if (Number.isFinite(until) && until > 0) setCooldownUntil(until)

    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const remainingMs = Math.max(0, (cooldownUntil || 0) - tick)
  const remainingSeconds = Math.ceil(remainingMs / 1000)
  const inCooldown = remainingSeconds > 0

  // ✅ Block background scroll while modal is open + focus the button
  React.useEffect(() => {
    if (!showSuccessModal) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // focus for kiosk / accessibility
    const t = setTimeout(() => acknowledgeRef.current?.focus(), 0)
    return () => {
      clearTimeout(t)
      document.body.style.overflow = prevOverflow
    }
  }, [showSuccessModal])

  function toggleArea(a) {
    setForm(f => {
      const exists = f.areas.includes(a)
      return { ...f, areas: exists ? f.areas.filter(x => x !== a) : [...f.areas, a] }
    })
  }

  function getOtherValue() {
    const v = (otherArea || '').trim()
    if (!v || v.toLowerCase() === 'other') return ''
    return v
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    // ✅ Hard-block submissions during cooldown (even if user tries to bypass disabled button)
    if (inCooldown) {
      setError(`Please wait ${formatRemaining(remainingSeconds)} before submitting another sign-in on this device.`)
      return
    }

    const otherVal = getOtherValue()
    const pickedAreas = [...(form.areas || [])]

    if (otherVal) {
      const otherLabel = `Other: ${otherVal}`
      if (!pickedAreas.includes(otherLabel)) pickedAreas.push(otherLabel)
    }

    if (
      !form.first_name ||
      !form.surname ||
      !form.company ||
      !form.phone ||
      pickedAreas.length === 0
    ) {
      setError('All fields are mandatory and at least one Area of work must be selected (or enter an Other area).')
      return
    }

    setLoading(true)

    const { error: err } = await supabase.from('contractors').insert({
      first_name: form.first_name.trim(),
      surname: form.surname.trim(),
      company: form.company.trim(),
      phone: form.phone.trim(),
      areas: pickedAreas,
      status: 'pending',
    })

    setLoading(false)

    if (err) {
      setError(err.message)
      return
    }

    // ✅ On success: set 2-minute cooldown cookie
    const until = Date.now() + SIGNIN_COOLDOWN_SECONDS * 1000
    setCookie(SIGNIN_COOLDOWN_COOKIE, String(until), SIGNIN_COOLDOWN_SECONDS)
    setCooldownUntil(until)
    setTick(Date.now())

    setMessage('Signed-in request recorded. Please see a Team Leader to receive a visitor fob.')
    setForm({ first_name: '', surname: '', company: '', phone: '', areas: [] })
    setOtherArea('Other')

    // ✅ Show modal on successful sign-in
    setShowSuccessModal(true)
  }

  return (
    <section className="max-w-xl mx-auto">
      {/* ✅ Modal overlay (fixed, does NOT change your page look/layout) */}
      {showSuccessModal && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signin-success-title"
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
            <div className="px-5 py-4 bg-emerald-50 border-b border-slate-200">
              <h2 id="signin-success-title" className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span aria-hidden="true">✅</span>
                Sign-in registered
              </h2>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-slate-800 leading-relaxed">
                ✅ <span className="font-semibold">Sign in registered</span>, please see a team leader before entering
                any operational areas. Obtain a fob for logging onto the depot protection system if required.
              </p>

              <div className="flex gap-3 rounded-lg bg-slate-50 border border-slate-200 p-4">
                <div className="text-lg leading-none" aria-hidden="true">
                  ℹ️
                </div>
                <p className="text-slate-700 leading-relaxed">
                  <span className="font-semibold">Any questions or concerns</span> please contact the on duty manager.
                </p>
              </div>

              {/* Optional: show cooldown notice in modal too (helps kiosk users) */}
              <div className="text-sm text-slate-600">
                This device will be able to submit again in{' '}
                <span className="font-mono font-semibold">{formatRemaining(remainingSeconds)}</span>.
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end">
              <button
                ref={acknowledgeRef}
                type="button"
                className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-sky-200"
                onClick={() => setShowSuccessModal(false)}
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Everything below is your original page (unchanged) */}
      <h1 className="text-2xl font-bold mb-4">Contractor/Visitor sign-in</h1>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded border border-slate-200">
        {/* Cooldown banner */}
        {inCooldown && (
          <div className="rounded border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2 text-sm">
            This device is temporarily locked from signing in again. Please wait{' '}
            <span className="font-mono font-semibold">{formatRemaining(remainingSeconds)}</span>.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-600">First name (unique identifier)</label>
            <input
              className="mt-1 w-full border rounded p-2"
              value={form.first_name}
              onChange={e => setForm({ ...form, first_name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600">Surname</label>
            <input
              className="mt-1 w-full border rounded p-2"
              value={form.surname}
              onChange={e => setForm({ ...form, surname: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600">Company</label>
            <input
              className="mt-1 w-full border rounded p-2"
              value={form.company}
              onChange={e => setForm({ ...form, company: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600">Phone number (unique identifier)</label>
            <input
              className="mt-1 w-full border rounded p-2"
              inputMode="tel"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Area of work (select one or more)</label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {AREAS.map(a => (
              <label
                key={a}
                className={`flex items-center gap-2 border rounded p-2 ${
                  form.areas.includes(a) ? 'bg-slate-100 border-slate-400' : 'border-slate-200'
                }`}
              >
                <input type="checkbox" checked={form.areas.includes(a)} onChange={() => toggleArea(a)} />
                {a}
              </label>
            ))}
          </div>

          <div className="mt-3">
            <label className="block text-sm text-slate-600 mb-1">Other (if not listed)</label>
            <input
              className="w-full border rounded p-2 bg-slate-50 focus:bg-white"
              value={otherArea}
              onChange={e => setOtherArea(e.target.value)}
              onFocus={() => {
                if ((otherArea || '').trim().toLowerCase() === 'other') setOtherArea('')
              }}
              onBlur={() => {
                if (!otherArea || otherArea.trim() === '') setOtherArea('Other')
              }}
            />
            <p className="text-xs text-slate-500 mt-1">
              If used, it will be saved as <span className="font-mono">Other: your text</span>.
            </p>
          </div>
        </div>

        {error && <p className="text-red-600">{error}</p>}
        {message && <p className="text-green-700">{message}</p>}

        <button
          disabled={loading || inCooldown}
          className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          title={inCooldown ? `Please wait ${formatRemaining(remainingSeconds)} to sign in again on this device.` : ''}
        >
          {loading ? 'Submitting...' : inCooldown ? `Locked (${formatRemaining(remainingSeconds)})` : 'Sign-in'}
        </button>
      </form>
    </section>
  )
}
