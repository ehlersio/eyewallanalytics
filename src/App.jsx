// EyeWall Analytics v1.1
import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Topbar from './components/Topbar'
import BottomNav from './components/BottomNav'
import ShotMapView from './views/ShotMapView'
import { PeriodSummaryProvider } from './utils/PeriodSummaryContext'
import { SportProvider, useSport } from './utils/SportContext'
import { capture } from './utils/analytics'
import './App.css'
import { hasTeamConfig, TEAM_CONFIG } from './utils/teamConfig'
import TeamPicker from './components/TeamPicker'
import { applyTeamTheme } from './utils/applyTeamTheme';
import { getTheme } from './utils/themeConfig';

// Lazy-load all non-initial routes — reduces initial bundle by ~64 KiB
const ScheduleView  = lazy(() => import('./views/ScheduleView'));
const PlayersView   = lazy(() => import('./views/PlayersView'));
const TeamView      = lazy(() => import('./views/TeamView'));
const NewsView      = lazy(() => import('./views/NewsView'));
const LeagueView    = lazy(() => import('./views/LeagueView'));

const PWHLShotMapView  = lazy(() => import('./views/PWHLShotMapView'));
const PWHLLeagueView   = lazy(() => import('./views/PWHLLeagueView'));
const PWHLScheduleView = lazy(() => import('./views/PWHLScheduleView'));
const PWHLPlayersView  = lazy(() => import('./views/PWHLPlayersView'));
const PWHLTeamView     = lazy(() => import('./views/PWHLTeamView'));
const PWHLNewsView     = lazy(() => import('./views/PWHLNewsView'));

const DevReplayView = import.meta.env.DEV
  ? lazy(() => import('./views/DevReplayView'))
  : null;

const DevDraftView = import.meta.env.DEV
  ? lazy(() => import('./views/DevDraftView'))
  : null;

const PWHLDevReplayView = import.meta.env.DEV
  ? lazy(() => import('./views/PWHLDevReplayView'))
  : null;

const ViewFallback = () => (
  <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>
    Loading…
  </div>
);

// Redirects PWHL users from / to /pwhl/shots
function RootRoute() {
  const { isPWHL } = useSport();
  if (isPWHL) return <Navigate to="/pwhl/shots" replace />;
  return <ShotMapView />;
}

// Tracks route changes as pageviews
function PageTracker() {
  const location = useLocation();
  useEffect(() => {
    const names = {
      '/':              'Shot Map',
      '/schedule':      'Schedule',
      '/players':       'Players',
      '/team':          'Team',
      '/news':          'News',
      '/league':        'League',
      '/pwhl/shots':    'PWHL Shot Map',
      '/pwhl/team':     'PWHL Team',
      '/pwhl/league':   'PWHL League',
      '/pwhl/players':  'PWHL Players',
      '/pwhl/schedule': 'PWHL Schedule',
      '/pwhl/news':     'PWHL News',
    };
    capture('$pageview', {
      path:      location.pathname,
      page_name: names[location.pathname] || location.pathname,
    });
  }, [location.pathname]);
  return null;
}

export default function App() {
  // In App component body, before the return:
  useEffect(() => {
    applyTeamTheme(TEAM_CONFIG, getTheme());
  }, []); // runs once on mount; full reload on team change means this always reflects current team  

  // Show team picker on first launch (no team saved yet).
  // After selection, reload so all modules re-initialize with the chosen team.
  const [needsTeam] = useState(() => !hasTeamConfig());

  if (needsTeam) {
    return (
      <TeamPicker
        onSelect={() => {
          // Full page reload — ensures TEAM_CONFIG (module-level constant) re-reads
          // the newly saved localStorage value across all imported modules.
          window.location.reload();
        }}
      />
    );
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SportProvider>
        <PeriodSummaryProvider>
          <div className="app-shell">
            <a href="#main-content" className="skip-link">Skip to main content</a>
            <PageTracker />
            <Topbar />
            <main id="main-content" className="app-main" aria-label="Main content">
              <Suspense fallback={<ViewFallback />}>
                <Routes>
                  <Route path="/"         element={<RootRoute />} />
                  <Route path="/schedule" element={<ScheduleView />} />
                  <Route path="/players"  element={<PlayersView />} />
                  <Route path="/team"     element={<TeamView />} />
                  <Route path="/news"     element={<NewsView />} />
                  <Route path="/league"   element={<LeagueView />} />
                  {/* PWHL routes */}
                  <Route path="/pwhl/shots"    element={<PWHLShotMapView />} />
                  <Route path="/pwhl/team"     element={<PWHLTeamView />} />
                  <Route path="/pwhl/league"   element={<PWHLLeagueView />} />
                  <Route path="/pwhl/players"  element={<PWHLPlayersView />} />
                  <Route path="/pwhl/schedule" element={<PWHLScheduleView />} />
                  <Route path="/pwhl/news"     element={<PWHLNewsView />} />
                  {import.meta.env.DEV && DevReplayView && (
                    <Route path="/dev" element={<DevReplayView />} />
                  )}
                  {import.meta.env.DEV && DevDraftView && (
                    <Route path="/dev/draft" element={<DevDraftView />} />
                  )}
                  {import.meta.env.DEV && PWHLDevReplayView && (
                    <Route path="/pwhl/dev" element={<PWHLDevReplayView />} />
                  )}
                </Routes>
              </Suspense>
            </main>
            <BottomNav />
          </div>
        </PeriodSummaryProvider>
      </SportProvider>
    </BrowserRouter>
  )
}
