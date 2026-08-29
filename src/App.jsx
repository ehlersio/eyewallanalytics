// EyeWall Analytics v1.1
import { lazy, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Topbar from './components/Topbar'
import BottomNav from './components/BottomNav'
import ShotMapView from './views/ShotMapView'
import { PeriodSummaryProvider } from './utils/PeriodSummaryContext'
import { SportProvider, useSport } from './utils/SportContext'
import { AuthProvider } from './utils/AuthContext'
import { capture } from './utils/analytics'
// App.css import removed (Phase 7b) -- migrated to Tailwind.
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

// AHL routes -- AHLTeamView added (parity plan Phase 1), AHLNewsView
// added (parity plan Phase 5, News tab only -- no Milestones/Trivia/
// Transactions, see AHLNewsView.jsx's own header comment for why).
const AHLShotMapView  = lazy(() => import('./views/AHLShotMapView'));
const AHLLeagueView   = lazy(() => import('./views/AHLLeagueView'));
const AHLScheduleView = lazy(() => import('./views/AHLScheduleView'));
const AHLPlayersView  = lazy(() => import('./views/AHLPlayersView'));
const AHLTeamView     = lazy(() => import('./views/AHLTeamView'));
const AHLNewsView     = lazy(() => import('./views/AHLNewsView'));

const DevReplayView = import.meta.env.DEV
  ? lazy(() => import('./views/DevReplayView'))
  : null;

const DevDraftView = import.meta.env.DEV
  ? lazy(() => import('./views/DevDraftView'))
  : null;

const PWHLDevReplayView = import.meta.env.DEV
  ? lazy(() => import('./views/PWHLDevReplayView'))
  : null;

const ViewFallback = () => {
  const { t } = useTranslation();
  return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>
      {t('common.loading')}
    </div>
  );
};

// Redirects PWHL/AHL users from / to their sport's shot map
function RootRoute() {
  const { isPWHL, isAHL } = useSport();
  if (isPWHL) return <Navigate to="/pwhl/shots" replace />;
  if (isAHL) return <Navigate to="/ahl/shots" replace />;
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
      '/ahl/shots':     'AHL Shot Map',
      '/ahl/league':    'AHL League',
      '/ahl/players':   'AHL Players',
      '/ahl/schedule':  'AHL Schedule',
      '/ahl/team':      'AHL Team',
      '/ahl/news':      'AHL News',
    };
    capture('$pageview', {
      path:      location.pathname,
      page_name: names[location.pathname] || location.pathname,
    });
  }, [location.pathname]);
  return null;
}

export default function App() {
  const { t } = useTranslation();
  // In App component body, before the return:
  useEffect(() => {
    applyTeamTheme(TEAM_CONFIG, getTheme());
  }, []); // runs once on mount; full reload on team change means this always reflects current team  

  // Show team picker on first launch (no team saved yet).
  // After selection, reload so all modules re-initialize with the chosen team.
  const [needsTeam] = useState(() => !hasTeamConfig());

  // AuthProvider wraps both branches below — TeamPicker is the sole place
  // team selection gets written (first launch and "Change team" both route
  // through it), and it needs auth state to sync a signed-in user's pick
  // to user_preferences (see favoriteTeamSync.js). It used to only wrap the
  // post-needsTeam branch, which left TeamPicker with no auth context at all.
  return (
    <AuthProvider>
      {needsTeam ? (
        <TeamPicker
          onSelect={() => {
            // Navigate to the correct root for the chosen sport before reloading
            // so module-level constants re-initialize at the right route.
            const sport = localStorage.getItem('eyewall:sport') || 'nhl';
            const root  = sport === 'pwhl' ? '/pwhl/shots' : sport === 'ahl' ? '/ahl/shots' : '/';
            window.location.href = root;
          }}
        />
      ) : (
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SportProvider>
            <PeriodSummaryProvider>
              {/* App.css migrated to Tailwind (Phase 7b). .app-shell's original
                  `height: 100vh; height: 100dvh;` double-declaration was a
                  fallback for browsers predating dvh support -- dropped in
                  favor of h-dvh alone, since dvh (Chrome 108+/Safari 15.4+/
                  Firefox 101+) is already a LOWER browser-support floor than
                  color-mix() (Chrome 111+/Safari 16.2+/Firefox 113+), which
                  this app already ships and relies on elsewhere (LeagueView's
                  Power Rankings YOU-row, ScoutingTab's badges). */}
              <div className="app-shell flex flex-col h-dvh overflow-hidden">
                <a href="#main-content" className="skip-link absolute -top-[100px] left-4 z-[9999] py-2 px-4 bg-[var(--red-bright)] text-white font-bold rounded-b-[8px] no-underline [transition:top_0.15s] focus:top-0 focus:outline-[3px] focus:outline-white focus:outline-offset-2">{t('app.skipToMainContent')}</a>
                <PageTracker />
                <Topbar />
                <main id="main-content" className="app-main flex-1 overflow-y-auto overflow-x-hidden pb-[calc(var(--nav-height)+env(safe-area-inset-bottom,0px))]" aria-label={t('app.mainContentAriaLabel')}>
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
                      {/* AHL routes */}
                      <Route path="/ahl/shots"    element={<AHLShotMapView />} />
                      <Route path="/ahl/team"     element={<AHLTeamView />} />
                      <Route path="/ahl/league"   element={<AHLLeagueView />} />
                      <Route path="/ahl/players"  element={<AHLPlayersView />} />
                      <Route path="/ahl/schedule" element={<AHLScheduleView />} />
                      <Route path="/ahl/news"     element={<AHLNewsView />} />
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
      )}
    </AuthProvider>
  )
}
