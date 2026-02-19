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
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <footer className="text-center text-xs text-slate-500 mt-6">
          <p>© {new Date().getFullYear()} ContractorECR</p>
        </footer>
      </main>
    </div>
  )
}
