// src/components/TeamPicker.jsx
// Full-screen team picker — shown on first launch (no saved team) and
// when the user wants to switch teams from the settings popup.
//
// Flow:
//   step 'sport' → user picks NHL or PWHL
//   step 'team'  → user picks a team from the sport's roster
//
// After the user taps a team, this calls the appropriate setTeamConfig()
// then onSelect(). The caller decides whether to reload the page.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ALL_TEAMS, setTeamConfig } from '../utils/teamConfig'
import { PWHL_TEAMS } from '../utils/pwhlConfig'
import { AHL_TEAMS, ahlLogoUrl } from '../utils/ahlConfig'
import { useAuth } from '../utils/AuthContext'
import { upsertFavoriteTeam } from '../utils/favoriteTeamSync'
import TeamLogo from './TeamLogo'
import EyeWallLogo from './EyeWallLogo'
import { TEAM_COLORS } from '../utils/nhlApi'

// Tailwind migration (Session 95, Phase 1) -- previously TeamPicker.css.
//
// .team-picker-disclaimer/.team-picker-tile/.team-picker-tile--disabled/
// .team-picker-abbr are kept as literal marker strings alongside the
// Tailwind utilities -- TeamPicker.cy.js selects and asserts on these
// exact class names. They carry no CSS of their own anymore; Tailwind
// owns the visuals, these are pure test hooks now.
//
// .team-picker-overlay's background was `var(--bg, #0d0d0f)` in the
// original CSS -- `--bg` (bare, no number) is never defined anywhere in
// this codebase (unlike --bg0/--bg1/etc, which are real), so this always
// rendered the literal fallback #0d0d0f regardless of light/dark theme.
// Reproduced as the literal color for exact parity, but flagging: since
// --text/--text-dim *are* real theme-reactive tokens, a user who set light
// mode in a previous session and then reopens TeamPicker via "Change team"
// would see light-mode near-black text (#0d1117) on this permanently-dark
// background -- a real, currently-live legibility issue, not something
// this migration should silently "fix" by guessing which token was meant.
//
// Hover lift (translateY) uses real CSS :hover; hover background/border-
// color are deliberately left as JS-driven inline styles (unchanged below)
// since they're genuinely dynamic (per-team brand color), matching the
// pattern already established for other components' dynamic values.
const OVERLAY_CLASSES = 'fixed inset-0 z-[1000] bg-[#0d0d0f] overflow-y-auto flex justify-center pt-12 px-4 pb-24';
const INNER_CLASSES = 'w-full max-w-[720px] pb-12';
const HEADER_CLASSES = 'text-center mb-10 relative';
const HEADER_LOGO_CLASSES = 'w-40 h-40 max-[480px]:w-20 max-[480px]:h-20 mx-auto mb-5 object-contain';
const TITLE_CLASSES = 'text-[1.75rem] font-bold text-[color:var(--text)] mb-2 tracking-[-0.02em]';
const SUB_CLASSES = 'text-[0.875rem] text-[color:var(--text-dim)] m-0';
const BACK_CLASSES = 'absolute left-0 top-1/2 -translate-y-1/2 max-[480px]:static max-[480px]:translate-y-0 max-[480px]:block max-[480px]:mb-3 max-[480px]:text-left bg-transparent border-0 text-[color:var(--text-dim)] text-[0.875rem] cursor-pointer py-1 px-0 [transition:color_0.12s] hover:text-[color:var(--text)]';
const SPORT_GRID_CLASSES = 'grid grid-cols-2 gap-4 max-[480px]:gap-3 mb-12';
const DISCLAIMER_CLASSES = 'team-picker-disclaimer text-[10px] text-[color:var(--text-dim)] text-center leading-[1.5] max-w-[480px] mx-auto';
const SPORT_TILE_CLASSES = 'flex flex-col items-center justify-center gap-2 py-10 px-6 max-[480px]:py-7 max-[480px]:px-4 border border-[var(--border)] rounded-[14px] cursor-pointer [transition:background_0.12s,border-color_0.12s,transform_0.1s] motion-reduce:transition-none bg-transparent hover:-translate-y-0.5 active:translate-y-0';
const SPORT_LOGO_CLASSES = 'max-h-12 max-w-full w-auto h-auto object-contain brightness-100';
const SPORT_DESC_CLASSES = 'text-[0.8125rem] text-[color:var(--text-dim)] text-center';
const DIVISIONS_CLASSES = 'flex flex-col gap-8 mb-12';
const DIVISION_LABEL_CLASSES = 'block text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-[color:var(--text-dim)] mb-3';
const GRID_CLASSES = 'grid grid-cols-4 gap-2 max-[480px]:gap-1.5';
const TILE_CLASSES = 'team-picker-tile flex flex-col items-center gap-1.5 pt-3.5 px-2 pb-3 max-[480px]:pt-2.5 max-[480px]:px-1 max-[480px]:pb-2 border border-[var(--border)] rounded-[10px] cursor-pointer [transition:background_0.12s,border-color_0.12s,transform_0.1s] motion-reduce:transition-none bg-transparent relative hover:-translate-y-0.5 active:translate-y-0';
const TILE_DISABLED_CLASSES = 'team-picker-tile--disabled opacity-40 cursor-not-allowed pointer-events-none';
const COMING_SOON_CLASSES = 'absolute top-[5px] right-[5px] text-[0.5rem] font-bold tracking-[0.06em] uppercase text-[color:var(--text-dim)] bg-[var(--bg2)] rounded-[4px] py-0.5 px-1 leading-none';
const ABBR_CLASSES = 'team-picker-abbr text-[0.6875rem] font-bold tracking-[0.06em] text-[color:var(--text-dim)] leading-none';
const NAME_CLASSES = 'text-[0.6875rem] text-[color:var(--text-dim)] leading-none text-center max-w-[72px] overflow-hidden text-ellipsis whitespace-nowrap';

// ── NHL division grouping ─────────────────────────────────────────────────────
const NHL_DIVISIONS = [
  {
    name: 'Atlantic',
    teams: ['BOS', 'BUF', 'DET', 'FLA', 'MTL', 'OTT', 'TBL', 'TOR'],
  },
  {
    name: 'Metropolitan',
    teams: ['CAR', 'CBJ', 'NJD', 'NYI', 'NYR', 'PHI', 'PIT', 'WSH'],
  },
  {
    name: 'Central',
    teams: ['CHI', 'COL', 'DAL', 'MIN', 'NSH', 'STL', 'UTA', 'WPG'],
  },
  {
    name: 'Pacific',
    teams: ['ANA', 'CGY', 'EDM', 'LAK', 'SJS', 'SEA', 'VAN', 'VGK'],
  },
];

// ── PWHL grouping ─────────────────────────────────────────────────────────────
// Active vs expansion is derived from each team's own `comingSoon` flag in
// pwhlConfig.js — not hardcoded here. This used to be two static abbr
// arrays that had to be kept in sync with pwhlConfig.js by hand, and had
// drifted: comingSoon was flipped to false for all four expansion teams,
// but these arrays were never touched, so they stayed permanently
// disabled here regardless of what pwhlConfig.js said.
const PWHL_ACTIVE_ABBRS    = PWHL_TEAMS.filter(t => !t.comingSoon).map(t => t.abbr);
const PWHL_EXPANSION_ABBRS = PWHL_TEAMS.filter(t => t.comingSoon).map(t => t.abbr);

// ── AHL grouping ──────────────────────────────────────────────────────────────
// AHL_DIVISIONS derived from ahlConfig.js's own `division` field, same
// "don't hand-duplicate the grouping" reasoning as PWHL_ACTIVE_ABBRS above.
const AHL_DIVISION_NAMES = ['Atlantic', 'North', 'Central', 'Pacific'];
const AHL_DIVISIONS = AHL_DIVISION_NAMES.map(name => ({
  name,
  teams: AHL_TEAMS.filter(t => t.division === name).map(t => t.abbr),
}));

// ── Lookups ───────────────────────────────────────────────────────────────────
const nhlTeamByAbbr  = Object.fromEntries(ALL_TEAMS.map(t => [t.abbr, t]));
const pwhlTeamByAbbr = Object.fromEntries(PWHL_TEAMS.map(t => [t.abbr, t]));
const ahlTeamByAbbr  = Object.fromEntries(AHL_TEAMS.map(t => [t.abbr, t]));

// ── Sport step ────────────────────────────────────────────────────────────────
function SportStep({ onPickSport }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(null);

  const sports = [
    {
      id: 'nhl',
      logo: '/nhl-assets/logos/nhl/svg/NHL_dark.svg',
      description: t('teamPicker.nhlDescription'),
    },
    {
      id: 'pwhl',
      logo: '/pwhl-logo.svg',
      description: t('teamPicker.pwhlDescription', { count: PWHL_ACTIVE_ABBRS.length }),
    },
    {
      // AHL's own asset CDN (assets.leaguestat.com) only hosts per-team
      // logos, no league wordmark -- self-hosted here instead, same
      // pattern as pwhl-logo.svg (official AHL shield logo, Wikimedia
      // Commons).
      id: 'ahl',
      logo: '/ahl-logo.svg',
      description: t('teamPicker.ahlDescription', { count: AHL_TEAMS.length }),
    },
  ];

  return (
    <>
      <div className={HEADER_CLASSES}>
        <EyeWallLogo alt="EyeWall Analytics" className={HEADER_LOGO_CLASSES} />
        <h1 className={TITLE_CLASSES}>{t('teamPicker.chooseLeague')}</h1>
        <p className={SUB_CLASSES}>{t('teamPicker.settingsHint')}</p>
      </div>
      <div className={SPORT_GRID_CLASSES}>
        {sports.map(({ id, logo, description }) => {
          const isHov = hovered === id;
          return (
            <button
              key={id}
              className={SPORT_TILE_CLASSES}
              style={{
                background: isHov ? 'var(--bg2)' : 'transparent',
                borderColor: isHov ? 'var(--text-dim)' : 'var(--border)',
              }}
              onClick={() => onPickSport(id)}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered(null)}
              aria-label={id.toUpperCase()}
            >
              {logo ? (
                <img
                  src={logo}
                  alt={id.toUpperCase()}
                  className={SPORT_LOGO_CLASSES}
                />
              ) : (
                <span className="text-[1.5rem] font-bold tracking-[0.04em] text-[color:var(--text)]">{id.toUpperCase()}</span>
              )}
              <span className={SPORT_DESC_CLASSES}>{description}</span>
            </button>
          );
        })}
      </div>
      <p className={DISCLAIMER_CLASSES}>
        {t('teamPicker.disclaimer')}
      </p>
    </>
  );
}

// ── NHL team grid ─────────────────────────────────────────────────────────────
function NHLTeamStep({ onBack, onSelect }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(null);

  return (
    <>
      <div className={HEADER_CLASSES}>
        <button className={BACK_CLASSES} onClick={onBack}>{t('teamPicker.back')}</button>
        <h1 className={TITLE_CLASSES}>{t('teamPicker.chooseTeam')}</h1>
        <p className={SUB_CLASSES}>{t('teamPicker.settingsHint')}</p>
      </div>
      <div className={DIVISIONS_CLASSES}>
        {NHL_DIVISIONS.map(division => (
          <div key={division.name}>
            <span className={DIVISION_LABEL_CLASSES}>{division.name}</span>
            <div className={GRID_CLASSES}>
              {division.teams.map(abbr => {
                const team  = nhlTeamByAbbr[abbr];
                const color = TEAM_COLORS[abbr] || '#888';
                const isHov = hovered === abbr;
                if (!team) return null;
                return (
                  <button
                    key={abbr}
                    className={TILE_CLASSES}
                    style={{
                      '--team-color': color,
                      background:  isHov ? `${color}22` : 'transparent',
                      borderColor: isHov ? color : 'var(--border)',
                    }}
                    onClick={() => onSelect(abbr)}
                    onMouseEnter={() => setHovered(abbr)}
                    onMouseLeave={() => setHovered(null)}
                    aria-label={team.displayName}
                  >
                    <TeamLogo abbr={abbr} size={48} />
                    <span className={ABBR_CLASSES}>{abbr}</span>
                    <span className={NAME_CLASSES}>{team.shortName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 48 }} aria-hidden="true" />
    </>
  );
}

// ── PWHL team grid ────────────────────────────────────────────────────────────
function PWHLTeamStep({ onBack, onSelect }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(null);

  return (
    <>
      <div className={HEADER_CLASSES}>
        <button className={BACK_CLASSES} onClick={onBack}>{t('teamPicker.back')}</button>
        <h1 className={TITLE_CLASSES}>{t('teamPicker.chooseTeam')}</h1>
        <p className={SUB_CLASSES}>{t('teamPicker.settingsHint')}</p>
      </div>
      <div className={DIVISIONS_CLASSES}>
        {/* Active teams */}
        <div>
          <span className={DIVISION_LABEL_CLASSES}>PWHL</span>
          <div className={GRID_CLASSES}>
            {PWHL_ACTIVE_ABBRS.map(abbr => {
              const team  = pwhlTeamByAbbr[abbr];
              const color = team?.displayColor || '#888';
              const isHov = hovered === abbr;
              if (!team) return null;
              return (
                <button
                  key={abbr}
                  className={TILE_CLASSES}
                  style={{
                    '--team-color': color,
                    background:  isHov ? `${color}22` : 'transparent',
                    borderColor: isHov ? color : 'var(--border)',
                  }}
                  onClick={() => onSelect(abbr)}
                  onMouseEnter={() => setHovered(abbr)}
                  onMouseLeave={() => setHovered(null)}
                  aria-label={team.displayName}
                >
                  <TeamLogo abbr={abbr} sport="pwhl" size={48} color={color} />
                  <span className={ABBR_CLASSES}>{abbr}</span>
                  <span className={NAME_CLASSES}>{team.shortName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Expansion teams — disabled. Hidden entirely once none are left. */}
        {PWHL_EXPANSION_ABBRS.length > 0 && (
        <div>
          <span className={DIVISION_LABEL_CLASSES}>{t('teamPicker.pwhlExpansionLabel')}</span>
          <div className={GRID_CLASSES}>
            {PWHL_EXPANSION_ABBRS.map(abbr => {
              const team = pwhlTeamByAbbr[abbr];
              if (!team) return null;
              return (
                <button
                  key={abbr}
                  className={`${TILE_CLASSES} ${TILE_DISABLED_CLASSES}`}
                  disabled
                  aria-label={t('teamPicker.comingSoonAriaLabel', { team: team.displayName })}
                >
                  <TeamLogo abbr={abbr} sport="pwhl" size={48} color="var(--text-dim)" />
                  <span className={ABBR_CLASSES}>{abbr}</span>
                  <span className={NAME_CLASSES}>{team.shortName}</span>
                  <span className={COMING_SOON_CLASSES}>{t('teamPicker.soonBadge')}</span>
                </button>
              );
            })}
          </div>
        </div>
        )}
      </div>
      <div style={{ height: 48 }} aria-hidden="true" />
    </>
  );
}

// ── AHL team grid ─────────────────────────────────────────────────────────────
// Uses AHL's own hosted team-logo CDN (ahlLogoUrl) rather than TeamLogo's
// abbr-keyed local-asset lookup -- TeamLogo has no AHL branch (see that
// component's own scope note) and adding 32 local logo files/mappings for
// a placeholder-color pass isn't warranted yet (see ahlConfig.js's
// AHL_PLACEHOLDER_COLOR comment) -- a plain <img> against the real logo
// URL is simpler and already what theahl.com's own site does.
function AHLTeamStep({ onBack, onSelect }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(null);

  return (
    <>
      <div className={HEADER_CLASSES}>
        <button className={BACK_CLASSES} onClick={onBack}>{t('teamPicker.back')}</button>
        <h1 className={TITLE_CLASSES}>{t('teamPicker.chooseTeam')}</h1>
        <p className={SUB_CLASSES}>{t('teamPicker.settingsHint')}</p>
      </div>
      <div className={DIVISIONS_CLASSES}>
        {AHL_DIVISIONS.map(division => (
          <div key={division.name}>
            <span className={DIVISION_LABEL_CLASSES}>{division.name}</span>
            <div className={GRID_CLASSES}>
              {division.teams.map(abbr => {
                const team  = ahlTeamByAbbr[abbr];
                const isHov = hovered === abbr;
                if (!team) return null;
                return (
                  <button
                    key={abbr}
                    className={TILE_CLASSES}
                    style={{
                      background:  isHov ? 'var(--bg2)' : 'transparent',
                      borderColor: isHov ? 'var(--text-dim)' : 'var(--border)',
                    }}
                    onClick={() => onSelect(abbr)}
                    onMouseEnter={() => setHovered(abbr)}
                    onMouseLeave={() => setHovered(null)}
                    aria-label={team.displayName}
                  >
                    <img src={ahlLogoUrl(team.teamId)} alt={abbr} width={48} height={48} className="object-contain" />
                    <span className={ABBR_CLASSES}>{abbr}</span>
                    <span className={NAME_CLASSES}>{team.shortName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 48 }} aria-hidden="true" />
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function TeamPicker({ onSelect }) {
  const [step, setStep]   = useState('sport'); // 'sport' | 'team'
  const [sport, setSport] = useState(null);    // 'nhl' | 'pwhl'
  // AuthProvider always wraps this component (see App.jsx) — for a
  // signed-out visitor, isAuthenticated is just false and the sync call
  // below never fires, so this adds nothing to that path.
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  function handlePickSport(id) {
    setSport(id);
    setStep('team');
  }

  function handleBack() {
    setStep('sport');
    setSport(null);
  }

  // Awaited (not fire-and-forget) before onSelect() triggers the reload —
  // AuthContext's reconcile-on-load runs again right after that reload, and
  // it needs to read back the value this write just sent, not a stale one.
  // If a pick happens before the initial getSession() resolves (authLoading
  // still true), the sync is skipped for that pick — a rare race on the
  // "Change team" path only, accepted rather than blocking first-launch
  // rendering on an auth check.
  async function syncIfSignedIn(sportId, abbr) {
    if (!authLoading && isAuthenticated) {
      await upsertFavoriteTeam(user.id, sportId, abbr);
    }
  }

  async function handleNHLSelect(abbr) {
    // Save sport choice then team, then let caller reload
    localStorage.setItem('eyewall:sport', 'nhl');
    setTeamConfig(abbr);
    // Consume the "Change team" flag (see NotificationBell.jsx /
    // favoriteTeamSync.js) now that a real pick has been made — first-launch
    // selects never set it, so this is a harmless no-op there.
    localStorage.removeItem('eyewall:team-change-pending');
    await syncIfSignedIn('nhl', abbr);
    onSelect?.(abbr);
  }

  async function handlePWHLSelect(abbr) {
    // eyewall:sport must be written before onSelect() triggers reload
    // so hasTeamConfig() checks eyewall:pwhl_team on the next mount.
    localStorage.setItem('eyewall:sport', 'pwhl');
    localStorage.setItem('eyewall:pwhl_team', JSON.stringify(pwhlTeamByAbbr[abbr]));
    localStorage.removeItem('eyewall:team-change-pending');
    await syncIfSignedIn('pwhl', abbr);
    onSelect?.(abbr);
  }

  async function handleAHLSelect(abbr) {
    localStorage.setItem('eyewall:sport', 'ahl');
    localStorage.setItem('eyewall:ahl_team', JSON.stringify(ahlTeamByAbbr[abbr]));
    localStorage.removeItem('eyewall:team-change-pending');
    await syncIfSignedIn('ahl', abbr);
    onSelect?.(abbr);
  }

  return (
    <div className={OVERLAY_CLASSES}>
      <div className={INNER_CLASSES}>
        {step === 'sport' && (
          <SportStep onPickSport={handlePickSport} />
        )}
        {step === 'team' && sport === 'nhl' && (
          <NHLTeamStep onBack={handleBack} onSelect={handleNHLSelect} />
        )}
        {step === 'team' && sport === 'pwhl' && (
          <PWHLTeamStep onBack={handleBack} onSelect={handlePWHLSelect} />
        )}
        {step === 'team' && sport === 'ahl' && (
          <AHLTeamStep onBack={handleBack} onSelect={handleAHLSelect} />
        )}
      </div>
    </div>
  );
}
