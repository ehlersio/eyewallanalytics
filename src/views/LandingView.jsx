// src/views/LandingView.jsx
// The marketing landing page: what a stranger sees at eyewallanalytics.com.
// App.jsx renders it outside the app shell and the router (no Topbar,
// BottomNav or BrowserRouter) at /welcome for every web visitor, and at /
// for a web visitor with no saved team; never in the iOS app
// (utils/landingGate.js). Lazy-loaded, so the entry chunk doesn't carry it.
//
// In-page links are plain <a href>s: /app (the team picker, or the app when
// a team is saved), /methodology, /privacy.html. Sections live in
// components/landing/, their links and media in landingContent.js.

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LandingNav from '../components/landing/LandingNav';
import LandingHero from '../components/landing/LandingHero';
import LeaguesBand from '../components/landing/LeaguesBand';
import FeatureSection from '../components/landing/FeatureSection';
import { Phones, LockScreenMedia, TwoWaysMedia } from '../components/landing/FeatureMedia';
import StatTiles, { SHOT_AREA_COUNT } from '../components/landing/StatTiles';
import ScorecardSection from '../components/landing/ScorecardSection';
import GetItSection from '../components/landing/GetItSection';
import LandingFooter from '../components/landing/LandingFooter';
import { FEATURE_SECTIONS } from '../components/landing/landingContent';
import { trackLandingView } from '../components/landing/landingAnalytics';

function mediaFor(section) {
  if (section.key === 'replays') return <TwoWaysMedia />;
  if (section.liveActivity) return <LockScreenMedia media={section.media} liveActivity={section.liveActivity} />;
  return <Phones media={section.media} />;
}

export default function LandingView() {
  const { t, i18n } = useTranslation();

  // Outside the router's PageTracker, so it counts its own view. Once per
  // load (StrictMode's dev double-mount aside: capture is off in dev).
  useEffect(() => { trackLandingView(window.location.pathname); }, []);

  // The page's language for screen readers and search engines, following
  // the footer's EN / FR switch.
  useEffect(() => {
    document.documentElement.lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2);
  }, [i18n.resolvedLanguage, i18n.language]);

  return (
    <div id="top" className="landing-view min-h-dvh overflow-x-clip bg-[var(--bg0)] text-[color:var(--text)]">
      <LandingNav />
      <main>
        <LandingHero />
        <LeaguesBand />
        {FEATURE_SECTIONS.map((section, i) => (
          <FeatureSection
            key={section.id}
            id={section.id}
            sectionKey={section.key}
            flip={i % 2 === 1}
            bodyValues={section.key === 'advanced' ? { areas: SHOT_AREA_COUNT } : undefined}
            media={mediaFor(section)}
          >
            {section.key === 'advanced' && <StatTiles />}
            {section.key === 'lock' && (
              <p className="m-0 mt-4 text-[13px] text-[color:var(--text-dim)]">{t('landing.lock.note')}</p>
            )}
          </FeatureSection>
        ))}
        <ScorecardSection />
        <GetItSection />
      </main>
      <LandingFooter />
    </div>
  );
}
