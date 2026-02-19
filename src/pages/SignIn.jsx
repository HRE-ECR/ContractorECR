import React from 'react'
import { supabase } from '../supabaseClient'

const AREAS = ['M1', 'M2', 'Insp', '1CL', '2CL', '3CL', '4CL']

export default function SignIn() {
  const [form, setForm] = React.useState({
    first_name: '',
    surname: '',
    company: '',
    phone: '',
    areas: [],
  })

  // "Other" box behaviour:
  // - Shows "Other" as text inside the box initially
  // - Clears when clicked/focused
  // - Restores "Other" if left empty on blur
  const [otherArea, setOtherArea] = React.useState('Other')

  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')

  function toggleArea(a) {
    setForm((f) => {
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

    // If user entered an "Other" value, store it as "Other: <value>"
    if (otherVal) {
      const otherLabel = `Other: ${otherVal}`
      if (!pickedAreas.includes(otherLabel)) pickedAreas.push(otherLabel)
    }

    // Validation: require at least one checkbox OR a valid Other value
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
      areas: pickedAreas, // ✅ now supports text[] (includes Other)
      status: 'pending',
    })
    setLoading(false)

    if (err) {
      setError(err.message)
    } else {
      setMessage('Signed-in request recorded. Please see a Team Leader to receive a visitor fob.')
      setForm({ first_name: '', surname: '', company: '', phone: '', areas: [] })
      setOtherArea('Other')
    }
  }

  return (
    <section className="max-w-xl mx-auto">
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
          <label className="block text-sm text-slate-600 mb-1">
            Area of work (select one or more)
          </label>

          <div className="grid grid-cols-3 gap-2">
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

          {/* Other field */}
          <div className="mt-3">
            <label className="block text-sm text-slate-600 mb-1">
              Other (if not listed)
            </label>
            <input
              className="w-full border rounded p-2 bg-slate-50 focus:bg-white"
              value={otherArea}
              onChange={e => setOtherArea(e.target.value)}
              onFocus={() => {
                // "Other" disappears when clicked
                if ((otherArea || '').trim().toLowerCase() === 'other') setOtherArea('')
              }}
              onBlur={() => {
                // Restore "Other" if left empty
                if (!otherArea || otherArea.trim() === '') setOtherArea('Other')
              }}
            />
            <p className="text-xs text-slate-500 mt-1">
              If you type an area here, it will be saved as <span className="font-mono">Other: your text</span>.
            </p>
          </div>
        </div>

        {error && <p className="text-red-600">{error}</p>}
        {message && <p className="text-green-700">{message}</p>}

        <button
          disabled={loading}
          className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Sign-in'}
        </button>
      </form>
    </section>
  )
}
