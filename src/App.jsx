import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Topbar from './components/Topbar'
import BottomNav from './components/BottomNav'
import ShotMapView from './views/ShotMapView'
import ScheduleView from './views/ScheduleView'
import PlayersView from './views/PlayersView'
import TeamView from './views/TeamView'
import NewsView from './views/NewsView'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        {/* Skip-to-content for keyboard/screen reader users */}
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Topbar />
        <main id="main-content" className="app-main" aria-label="Main content">
          <Routes>
            <Route path="/"         element={<ShotMapView />} />
            <Route path="/schedule" element={<ScheduleView />} />
            <Route path="/players"  element={<PlayersView />} />
            <Route path="/team"     element={<TeamView />} />
            <Route path="/news"     element={<NewsView />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
