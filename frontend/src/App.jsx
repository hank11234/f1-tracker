import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import Drivers from './pages/Drivers.jsx'
import DriverDetail from './pages/DriverDetail.jsx'
import Teams from './pages/Teams.jsx'
import TeamDetail from './pages/TeamDetail.jsx'
import Sessions from './pages/Sessions.jsx'
import SessionDetail from './pages/SessionDetail.jsx'
import Tracks from './pages/Tracks.jsx'
import TrackDetail from './pages/TrackDetail.jsx'
import Cars from './pages/Cars.jsx'

export default function App() {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="page-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/drivers/:id" element={<DriverDetail />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/:id" element={<TeamDetail />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/sessions/:key" element={<SessionDetail />} />
          <Route path="/tracks" element={<Tracks />} />
          <Route path="/tracks/:id" element={<TrackDetail />} />
          <Route path="/cars" element={<Cars />} />
        </Routes>
      </main>
    </div>
  )
}
