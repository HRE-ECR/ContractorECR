import React from 'react'
import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <section className="py-10 space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">
        Craigentinny Contractor / Visitor Management
      </h1>

      <p className="text-slate-600">
        Please choose an option below.
      </p>

      {/* Only 2 tiles now (Team leader login removed from landing page) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Sign-in (subtle green) */}
        <Link
          to="/sign-in"
          className="p-6 rounded-lg bg-emerald-50 border border-emerald-200 shadow-sm hover:shadow-md hover:bg-emerald-100 transition"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-emerald-900 mb-2">
                Contractor/Visitor sign-in
              </h2>
              <p className="text-emerald-900/80">
                Register your on-site presence.
              </p>
            </div>
            <span
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800"
              aria-hidden="true"
              title="Sign-in"
            >
              ✓
            </span>
          </div>
        </Link>

        {/* Sign-out (subtle red) */}
        <Link
          to="/sign-out"
          className="p-6 rounded-lg bg-rose-50 border border-rose-200 shadow-sm hover:shadow-md hover:bg-rose-100 transition"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-rose-900 mb-2">
                Contractor/Visitor sign-out
              </h2>
              <p className="text-rose-900/80">
                Request to leave site. Team leader will confirm.
              </p>
            </div>
            <span
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-rose-100 border border-rose-200 text-rose-800"
              aria-hidden="true"
              title="Sign-out"
            >
              ⟲
            </span>
          </div>
        </Link>
      </div>

      <div className="text-xs text-slate-500 pt-2">
        Please sign in, your First name and Phone number will be your unique identifier.
      </div>
    </section>
  )
}
