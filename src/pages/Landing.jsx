import React from 'react'
import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Craigentinny Contractor / Visitor Management
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Please choose an option below.
          </p>
        </header>

        {/* Only 2 tiles now (Team leader login removed from landing page) */}
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Sign-in (subtle green) */}
          <Link
            to="/signin"
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition
                       hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-emerald-950 dark:text-emerald-50">
                  Contractor/Visitor sign-in
                </h2>
                <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-100/95">
                  Register your on-site presence.
                </p>
              </div>

              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl
                           bg-emerald-100/70 text-emerald-950 ring-1 ring-emerald-200
                           group-hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-50 dark:ring-emerald-900/40"
                aria-hidden="true"
                title="Sign in"
              >
                ✓
              </div>
            </div>
          </Link>

          {/* Sign-out (subtle red) */}
          <Link
            to="/signout"
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition
                       hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-rose-950 dark:text-rose-50">
                  Contractor/Visitor sign-out
                </h2>
                <p className="mt-1 text-sm text-rose-900 dark:text-rose-100/95">
                  Request to leave site. Team leader will confirm.
                </p>
              </div>

              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl
                           bg-rose-100/70 text-rose-950 ring-1 ring-rose-200
                           group-hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-50 dark:ring-rose-900/40"
                aria-hidden="true"
                title="Sign out"
              >
                ⟲
              </div>
            </div>
          </Link>
        </div>

        <p className="mt-8 text-sm text-slate-600 dark:text-slate-300">
          Please sign in, your First name and Phone number will be your unique identifier.
        </p>
      </div>
    </div>
  )
}
``
