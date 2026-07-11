// EyeWall Analytics v1.1
import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Topbar from './components/Topbar'
import BottomNav from './components/BottomNav'
import ViewportDebugOverlay from './components/ViewportDebugOverlay'
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

// Session 53 -- BottomNav mobile regression investigation. Live device
// logging (installed home-screen PWA, standalone mode) caught a ~1.5s
// window after navigating between tabs where window.innerHeight/
// visualViewport.height grew by exactly the safe-area-inset-top amount
// (iOS's own chrome animating away, unexpectedly, inside what's supposed
// to be a chrome-less standalone app) -- .app-shell's height:100dvh
// tracks that growth on every intermediate frame, and .bottom-nav's
// rendered position visibly lagged behind it for the duration before
// settling. Rather than let .app-shell's height react continuously to
// every mid-animation resize tick, this debounces it to a single update
// once resize activity actually settles -- the same shape as the
// long-standing "--vh custom property" mobile-viewport workaround, just
// applied to reduce reflow churn during the animation instead of trying
// to read a value that doesn't exist yet (dvh already resolves that part
// correctly; the growing DELTA is what appears to be blowing up).
// Unverified against the real device -- no way to test this session
// without it in hand.
function useStableViewportHeight() {
  useEffect(() => {
    const root = document.documentElement;
    let timer = null;
    const commit = () => {
      root.style.setProperty('--app-vh', `${window.innerHeight}px`);
    };
    commit();
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(commit, 200);
    };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, []);
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
    // Session 53 -- BottomNav mobile regression investigation: nothing
    // reset .app-main's scroll position on tab switch, so arriving at a
    // differently-sized page while still scrolled down from the previous
    // one was a real, checkable gap (confirmed via live device debug
    // logging) that could compound with iOS's standalone-PWA viewport
    // resize animation (see useStableViewportHeight below).
    document.getElementById('main-content')?.scrollTo(0, 0);
  }, [location.pathname]);
  return null;
}

export default function App() {
  // In App component body, before the return:
  useEffect(() => {
    applyTeamTheme(TEAM_CONFIG, getTheme());
  }, []); // runs once on mount; full reload on team change means this always reflects current team

  useStableViewportHeight();

  // Show team picker on first launch (no team saved yet).
  // After selection, reload so all modules re-initialize with the chosen team.
  const [needsTeam] = useState(() => !hasTeamConfig());

  if (needsTeam) {
    return (
      <TeamPicker
        onSelect={() => {
          // Navigate to the correct root for the chosen sport before reloading
          // so module-level constants re-initialize at the right route.
          const sport = localStorage.getItem('eyewall:sport') || 'nhl';
          const root  = sport === 'pwhl' ? '/pwhl/shots' : '/';
          window.location.href = root;
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
            <ViewportDebugOverlay />
          </div>
        </PeriodSummaryProvider>
      </SportProvider>
    </BrowserRouter>
  )
}
