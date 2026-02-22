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

    const otherVal = getOtherValue()
    const pickedAreas = [...(form.areas || [])]

    if (otherVal) {
      const otherLabel = `Other: ${otherVal}`
      if (!pickedAreas.includes(otherLabel)) pickedAreas.push(otherLabel)
    }

    if (!form.first_name || !form.surname || !form.company || !form.phone || pickedAreas.length === 0) {
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

    if (err) setError(err.message)
    else {
      setMessage('Signed-in request recorded. Please see a Team Leader to receive a visitor fob.')
      setForm({ first_name: '', surname: '', company: '', phone: '', areas: [] })
      setOtherArea('Other')

      // ✅ Show modal on successful sign-in
      setShowSuccessModal(true)
    }
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
                <input
                  type="checkbox"
                  checked={form.areas.includes(a)}
                  onChange={() => toggleArea(a)}
                />
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

        <button disabled={loading} className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50">
          {loading ? 'Submitting...' : 'Sign-in'}
        </button>
      </form>
    </section>
  )
}
