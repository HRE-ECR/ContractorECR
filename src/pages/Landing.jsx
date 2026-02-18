
import React from 'react'
import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <section className="py-10 space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Welcome to Site Pass</h1>
      <p className="text-slate-600">Please choose an option below.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/sign-in" className="p-6 rounded-lg bg-white shadow hover:shadow-md border border-slate-200">
          <h2 className="text-xl font-semibold mb-2">Contractor/Visitor sign-in</h2>
          <p>Register your on-site presence.</p>
        </Link>
        <Link to="/sign-out" className="p-6 rounded-lg bg-white shadow hover:shadow-md border border-slate-200">
          <h2 className="text-xl font-semibold mb-2">Contractor/Visitor sign-out</h2>
          <p>Request to leave site. Team leader will confirm.</p>
        </Link>
        <Link to="/login" className="p-6 rounded-lg bg-white shadow hover:shadow-md border border-slate-200">
          <h2 className="text-xl font-semibold mb-2">Team leader login</h2>
          <p>View & manage on-site contractors/visitors.</p>
        </Link>
      </div>
    </section>
  )
}
