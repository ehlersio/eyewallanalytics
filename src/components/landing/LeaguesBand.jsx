// src/components/landing/LeaguesBand.jsx
// The four leagues and their team counts, from the same team lists the team
// picker uses, above a PWHL and an AHL shot map from the app. Always on the
// dark Night Rink sheet: the league marks are white-on-dark artwork (the
// team picker is dark in both themes for the same reason).

import { useTranslation } from 'react-i18next';
import { ALL_TEAMS } from '../../utils/teamConfig';
import { PWHL_TEAMS } from '../../utils/pwhlConfig';
import { AHL_TEAMS } from '../../utils/ahlConfig';
import { ECHL_TEAMS } from '../../utils/echlConfig';
import { NATIVE_ORIGIN } from '../../utils/nativeOrigin';
import { Phones } from './FeatureMedia';
import { LEAGUE_SHOTS } from './landingContent';

const LEAGUES = [
  { key: 'NHL', logo: `${NATIVE_ORIGIN}/nhl-assets/logos/nhl/svg/NHL_dark.svg`, count: ALL_TEAMS.length },
  { key: 'PWHL', logo: '/pwhl-logo.svg', count: PWHL_TEAMS.filter(team => !team.comingSoon).length },
  { key: 'AHL', logo: '/ahl-logo.svg', count: AHL_TEAMS.length },
  { key: 'ECHL', logo: '/echl-logo.png', count: ECHL_TEAMS.length },
];

export default function LeaguesBand() {
  const { t } = useTranslation();
  return (
    <section id="leagues" className="landing-leagues scroll-mt-[72px] bg-[#0B1426]" aria-label={t('landing.nav.leagues')}>
      <ul className="mx-auto grid w-full max-w-[1120px] list-none grid-cols-2 gap-x-4 gap-y-6 px-4 py-8 md:grid-cols-4 md:px-8 md:py-10">
        {LEAGUES.map(league => (
          <li key={league.key} className="flex flex-col items-center gap-2.5 text-center">
            <img src={league.logo} alt={league.key} className="h-12 w-auto max-w-[120px] object-contain" loading="lazy" decoding="async" />
            <span className="font-[family-name:var(--font-mono)] text-[11.5px] uppercase tracking-[0.08em] text-[#8a99aa]">
              {t('landing.hero.leagueChip', { league: league.key, count: league.count })}
            </span>
          </li>
        ))}
      </ul>
      <div className="mx-auto w-full max-w-[1120px] px-4 pb-12 md:px-8 md:pb-16">
        <Phones media={LEAGUE_SHOTS} />
      </div>
    </section>
  );
}
