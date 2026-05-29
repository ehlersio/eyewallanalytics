// EyeWall Analytics v1.1
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Topbar from './components/Topbar'
import BottomNav from './components/BottomNav'
import ShotMapView from './views/ShotMapView'
import ScheduleView from './views/ScheduleView'
import PlayersView from './views/PlayersView'
import TeamView from './views/TeamView'
import NewsView from './views/NewsView'
import './App.css'

const DevReplayView = import.meta.env.DEV
  ? lazy(() => import('./views/DevReplayView'))
  : null;

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
            {import.meta.env.DEV && DevReplayView && (
              <Route path="/dev" element={
                <Suspense fallback={<div style={{padding:32,color:'var(--text-dim)'}}>Loading dev tools…</div>}>
                  <DevReplayView />
                </Suspense>
              } />
            )}
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
