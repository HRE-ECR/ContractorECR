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

  // ✅ Success modal state
  const [showSuccessModal, setShowSuccessModal] = React.useState(false)
  const acknowledgeBtnRef = React.useRef(null)

  // ✅ Lock body scroll when modal is open
  React.useEffect(() => {
    if (!showSuccessModal) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus the acknowledge button for accessibility / kiosk flow
    const t = setTimeout(() => {
      acknowledgeBtnRef.current?.focus()
    }, 0)

    return () => {
      clearTimeout(t)
      document.body.style.overflow = prevOverflow
    }
  }, [showSuccessModal])

  function toggleArea(a) {
    setForm((f) => {
      const exists = f.areas.includes(a)
      return {
        ...f,
        areas: exists ? f.areas.filter((x) => x !== a) : [...f.areas, a],
      }
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

    if (
      !form.first_name ||
      !form.surname ||
      !form.company ||
      !form.phone ||
      pickedAreas.length === 0
    ) {
      setError(
        'All fields are mandatory and at least one Area of work must be selected (or enter an Other area).'
      )
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
    } else {
      // Keep your existing message behaviour (page stays as-is)
      setMessage('Signed-in request recorded. Please see a Team Leader to receive a visitor fob.')

      // Reset form exactly as you already do
      setForm({ first_name: '', surname: '', company: '', phone: '', areas: [] })
      setOtherArea('Other')

      // ✅ Show the success modal
      setShowSuccessModal(true)
    }
  }

  return (
    <>
      {/* ✅ Modal styles (scoped) */}
      <style>{`
        .successModalOverlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
        }
        .successModalCard {
          width: min(680px, 100%);
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.35);
          border: 1px solid rgba(2, 6, 23, 0.10);
          overflow: hidden;
          transform: translateY(6px);
          animation: popIn 160ms ease-out forwards;
        }
        @keyframes popIn {
          from { opacity: 0; transform: translateY(10px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .successModalHeader {
          padding: 18px 20px 10px 20px;
          background: linear-gradient(180deg, rgba(34,197,94,0.10), rgba(34,197,94,0.00));
          border-bottom: 1px solid rgba(2, 6, 23, 0.08);
        }
        .successModalTitle {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .successModalBody {
          padding: 14px 20px 18px 20px;
          color: #0f172a;
          line-height: 1.45;
          font-size: 15px;
        }
        .successModalCallout {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(59,130,246,0.08);
          border: 1px solid rgba(59,130,246,0.18);
          color: #0b1220;
          font-size: 14px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .successModalFooter {
          padding: 14px 20px 18px 20px;
          display: flex;
          justify-content: flex-end;
          border-top: 1px solid rgba(2, 6, 23, 0.08);
          background: #fff;
        }
        .successModalBtn {
          appearance: none;
          border: none;
          border-radius: 12px;
          padding: 10px 14px;
          font-weight: 700;
          cursor: pointer;
          background: #0f172a;
          color: #ffffff;
          box-shadow: 0 8px 24px rgba(15,23,42,0.18);
        }
        .successModalBtn:focus {
          outline: 3px solid rgba(59,130,246,0.55);
          outline-offset: 2px;
        }
        .successModalBtn:active {
          transform: translateY(1px);
        }
      `}</style>

      {/* ✅ Success Modal (blocks background scroll & clicks, no click-outside close) */}
      {showSuccessModal && (
        <div
          className="successModalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-modal-title"
          // Block clicks from passing through the overlay:
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <div
            className="successModalCard"
            onMouseDown={(e) => {
              // Prevent “click background to close” behaviour in some setups
              e.stopPropagation()
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="successModalHeader">
              <h2 id="success-modal-title" className="successModalTitle">
                <span aria-hidden="true">✅</span>
                Sign-in registered
              </h2>
            </div>

            <div className="successModalBody">
              <div>
                ✅ <strong>Sign-in registered</strong>Please see a team leader before entering any
                operational areas. Please obtain a fob for logging onto the depot protection system, if
                required.
              </div>

              <div className="successModalCallout">
                <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
                  ℹ️
                </span>
                <div>
                  <strong>Any questions or concerns</strong> please contact the on duty manager.
                </div>
              </div>
            </div>

            <div className="successModalFooter">
              <button
                ref={acknowledgeBtnRef}
                type="button"
                className="successModalBtn"
                onClick={() => setShowSuccessModal(false)}
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Your existing page content below (unchanged) */}
      <h2>Contractor/Visitor sign-in</h2>

      <form onSubmit={handleSubmit}>
        <label>
          First name (unique identifier)
          <input
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            required
          />
        </label>

        <label>
          Surname
          <input
            value={form.surname}
            onChange={(e) => setForm({ ...form, surname: e.target.value })}
            required
          />
        </label>

        <label>
          Company
          <input
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            required
          />
        </label>

        <label>
          Phone number (unique identifier)
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
        </label>

        <fieldset>
          <legend>Area of work (select one or more)</legend>

          {AREAS.map((a) => (
            <label key={a}>
              <input type="checkbox" checked={form.areas.includes(a)} onChange={() => toggleArea(a)} />
              {a}
            </label>
          ))}
        </fieldset>

        <label>
          Other (if not listed)
          <input
            value={otherArea}
            onChange={(e) => setOtherArea(e.target.value)}
            onFocus={() => {
              if ((otherArea || '').trim().toLowerCase() === 'other') setOtherArea('')
            }}
            onBlur={() => {
              if (!otherArea || otherArea.trim() === '') setOtherArea('Other')
            }}
          />
        </label>

        <small>If used, it will be saved as Other: your text.</small>

        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        {message && <p style={{ color: 'green' }}>{message}</p>}

        <button disabled={loading} type="submit">
          {loading ? 'Submitting...' : 'Sign-in'}
        </button>
      </form>
    </>
  )
}
