import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { api } from '../api.js'

export default function Navbar() {
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    setSyncing(true)
    try {
      await api.sync()
      setTimeout(() => setSyncing(false), 2000)
    } catch {
      setSyncing(false)
    }
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="navbar-brand">
          <span className="navbar-f1-logo">F1</span>
          <span className="navbar-title">Tracker</span>
        </div>

        <div className="navbar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Home
          </NavLink>
          <NavLink to="/drivers" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Drivers
          </NavLink>
          <NavLink to="/teams" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Teams
          </NavLink>
          <NavLink to="/sessions" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Sessions
          </NavLink>
          <NavLink to="/tracks" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Tracks
          </NavLink>
          <NavLink to="/cars" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Cars
          </NavLink>
        </div>

        <div className="navbar-actions">
          <div className="status-dot" title="Live" />
          <button className="sync-btn" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>
    </nav>
  )
}
