// EyeWall Analytics v1.1
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Topbar from './components/Topbar'
import BottomNav from './components/BottomNav'
import ShotMapView from './views/ShotMapView'
import { PeriodSummaryProvider } from './utils/PeriodSummaryContext'
import './App.css'

// Lazy-load all non-initial routes — reduces initial bundle by ~64 KiB
const ScheduleView  = lazy(() => import('./views/ScheduleView'));
const PlayersView   = lazy(() => import('./views/PlayersView'));
const TeamView      = lazy(() => import('./views/TeamView'));
const NewsView      = lazy(() => import('./views/NewsView'));

const DevReplayView = import.meta.env.DEV
  ? lazy(() => import('./views/DevReplayView'))
  : null;

const ViewFallback = () => (
  <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>
    Loading…
  </div>
);

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PeriodSummaryProvider>
        <div className="app-shell">
          {/* Skip-to-content for keyboard/screen reader users */}
          <a href="#main-content" className="skip-link">Skip to main content</a>
          <Topbar />
          <main id="main-content" className="app-main" aria-label="Main content">
            <Suspense fallback={<ViewFallback />}>
              <Routes>
                <Route path="/"         element={<ShotMapView />} />
                <Route path="/schedule" element={<ScheduleView />} />
                <Route path="/players"  element={<PlayersView />} />
                <Route path="/team"     element={<TeamView />} />
                <Route path="/news"     element={<NewsView />} />
                {import.meta.env.DEV && DevReplayView && (
                  <Route path="/dev" element={<DevReplayView />} />
                )}
              </Routes>
            </Suspense>
          </main>
          <BottomNav />
        </div>
      </PeriodSummaryProvider>
    </BrowserRouter>
  )
}
