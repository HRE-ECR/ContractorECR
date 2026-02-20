import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import Landing from './pages/Landing'
import SignIn from './pages/SignIn'
import SignOut from './pages/SignOut'
import TeamLogin from './pages/TeamLogin'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'

import NavBar from './components/NavBar'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-out" element={<SignOut />} />
          <Route path="/login" element={<TeamLogin />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Dashboard (role gating will be enforced via ProtectedRoute once we patch it next) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Screen display (placeholder for now — we'll replace with ScreenDisplay.jsx after you post NavBar + ProtectedRoute) */}
          <Route
            path="/screen"
            element={
              <ProtectedRoute>
                <div className="bg-white border rounded p-6">
                  <h1 className="text-2xl font-bold mb-2">Screen display</h1>
                  <p className="text-slate-600">
                    Screen display page is being added next. Post your NavBar.jsx and ProtectedRoute.jsx and I’ll wire this
                    up properly (Display role access + Teamleader access + realtime refresh).
                  </p>
                </div>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>

        <footer className="text-center text-xs text-slate-500 mt-6">
          <p>© {new Date().getFullYear()} ContractorECR</p>
        </footer>
      </main>
    </div>
  )
}
