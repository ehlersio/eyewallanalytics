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
import { ALL_TEAMS, setTeamConfig } from '../utils/teamConfig'
import { PWHL_TEAMS } from '../utils/pwhlConfig'
import { useAuth } from '../utils/AuthContext'
import { upsertFavoriteTeam } from '../utils/favoriteTeamSync'
import TeamLogo from './TeamLogo'
import { TEAM_COLORS } from '../utils/nhlApi'
import './TeamPicker.css'

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

// ── Lookups ───────────────────────────────────────────────────────────────────
const nhlTeamByAbbr  = Object.fromEntries(ALL_TEAMS.map(t => [t.abbr, t]));
const pwhlTeamByAbbr = Object.fromEntries(PWHL_TEAMS.map(t => [t.abbr, t]));

// ── Sport step ────────────────────────────────────────────────────────────────
function SportStep({ onPickSport }) {
  const [hovered, setHovered] = useState(null);

  const sports = [
    {
      id: 'nhl',
      logo: '/nhl-assets/logos/nhl/svg/NHL_dark.svg',
      description: 'All 32 teams · Full analytics',
    },
    {
      id: 'pwhl',
      logo: '/pwhl-logo.svg',
      description: `All ${PWHL_ACTIVE_ABBRS.length} teams · Full analytics`,
    },
  ];

  return (
    <>
      <div className="team-picker-header">
        <h1 className="team-picker-title">Choose your league</h1>
        <p className="team-picker-sub">You can change this any time from settings.</p>
      </div>
      <div className="team-picker-sport-grid">
        {sports.map(({ id, logo, description }) => {
          const isHov = hovered === id;
          return (
            <button
              key={id}
              className="team-picker-sport-tile"
              style={{
                background: isHov ? 'var(--bg2)' : 'transparent',
                borderColor: isHov ? 'var(--text-dim)' : 'var(--border)',
              }}
              onClick={() => onPickSport(id)}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered(null)}
              aria-label={id.toUpperCase()}
            >
              <img
                src={logo}
                alt={id.toUpperCase()}
                className="team-picker-sport-logo"
              />
              <span className="team-picker-sport-desc">{description}</span>
            </button>
          );
        })}
      </div>
      <p className="team-picker-disclaimer">
        EyeWall Analytics is not affiliated with, endorsed by, or sponsored by the National Hockey League (NHL), the Professional Women's Hockey League (PWHL), or any of their teams. All NHL and PWHL team names, logos, and trademarks are the property of their respective owners. Statistics and data are sourced from publicly available APIs and are provided for informational purposes only.
      </p>
    </>
  );
}

// ── NHL team grid ─────────────────────────────────────────────────────────────
function NHLTeamStep({ onBack, onSelect }) {
  const [hovered, setHovered] = useState(null);

  return (
    <>
      <div className="team-picker-header">
        <button className="team-picker-back" onClick={onBack}>← Back</button>
        <h1 className="team-picker-title">Choose your team</h1>
        <p className="team-picker-sub">You can change this any time from settings.</p>
      </div>
      <div className="team-picker-divisions">
        {NHL_DIVISIONS.map(division => (
          <div key={division.name} className="team-picker-division">
            <span className="team-picker-division-label">{division.name}</span>
            <div className="team-picker-grid">
              {division.teams.map(abbr => {
                const team  = nhlTeamByAbbr[abbr];
                const color = TEAM_COLORS[abbr] || '#888';
                const isHov = hovered === abbr;
                if (!team) return null;
                return (
                  <button
                    key={abbr}
                    className="team-picker-tile"
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
                    <span className="team-picker-abbr">{abbr}</span>
                    <span className="team-picker-name">{team.shortName}</span>
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
  const [hovered, setHovered] = useState(null);

  return (
    <>
      <div className="team-picker-header">
        <button className="team-picker-back" onClick={onBack}>← Back</button>
        <h1 className="team-picker-title">Choose your team</h1>
        <p className="team-picker-sub">You can change this any time from settings.</p>
      </div>
      <div className="team-picker-divisions">
        {/* Active teams */}
        <div className="team-picker-division">
          <span className="team-picker-division-label">PWHL</span>
          <div className="team-picker-grid">
            {PWHL_ACTIVE_ABBRS.map(abbr => {
              const team  = pwhlTeamByAbbr[abbr];
              const color = team?.displayColor || '#888';
              const isHov = hovered === abbr;
              if (!team) return null;
              return (
                <button
                  key={abbr}
                  className="team-picker-tile"
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
                  <span className="team-picker-abbr">{abbr}</span>
                  <span className="team-picker-name">{team.shortName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Expansion teams — disabled. Hidden entirely once none are left. */}
        {PWHL_EXPANSION_ABBRS.length > 0 && (
        <div className="team-picker-division">
          <span className="team-picker-division-label">2026–27 Expansion</span>
          <div className="team-picker-grid">
            {PWHL_EXPANSION_ABBRS.map(abbr => {
              const team = pwhlTeamByAbbr[abbr];
              if (!team) return null;
              return (
                <button
                  key={abbr}
                  className="team-picker-tile team-picker-tile--disabled"
                  disabled
                  aria-label={`${team.displayName} — coming soon`}
                >
                  <TeamLogo abbr={abbr} sport="pwhl" size={48} color="var(--text-dim)" />
                  <span className="team-picker-abbr">{abbr}</span>
                  <span className="team-picker-name">{team.shortName}</span>
                  <span className="team-picker-coming-soon">Soon</span>
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

  return (
    <div className="team-picker-overlay">
      <div className="team-picker-inner">
        {step === 'sport' && (
          <SportStep onPickSport={handlePickSport} />
        )}
        {step === 'team' && sport === 'nhl' && (
          <NHLTeamStep onBack={handleBack} onSelect={handleNHLSelect} />
        )}
        {step === 'team' && sport === 'pwhl' && (
          <PWHLTeamStep onBack={handleBack} onSelect={handlePWHLSelect} />
        )}
      </div>
    </div>
  );
}
