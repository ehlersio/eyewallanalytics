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
import { PWHL_TEAMS, PWHL_CURRENT_SEASON } from '../utils/pwhlConfig'
import { setSportAndReload } from '../utils/SportContext'
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
    teams: ['ARI', 'CHI', 'COL', 'DAL', 'MIN', 'NSH', 'STL', 'UTA', 'WPG'],
  },
  {
    name: 'Pacific',
    teams: ['ANA', 'CGY', 'EDM', 'LAK', 'SJS', 'SEA', 'VAN', 'VGK'],
  },
];

// ── PWHL grouping ─────────────────────────────────────────────────────────────
// Split into active (selectable) and expansion (coming soon / disabled).
const PWHL_ACTIVE_ABBRS  = ['BOS', 'MIN', 'MTL', 'NY', 'OTT', 'TOR', 'SEA', 'VAN'];
const PWHL_EXPANSION_ABBRS = ['DET', 'HAM', 'LV', 'SJS'];

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
      description: '8 active teams · Growing fast',
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

        {/* Expansion teams — disabled */}
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
      </div>
      <div style={{ height: 48 }} aria-hidden="true" />
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function TeamPicker({ onSelect }) {
  const [step, setStep]   = useState('sport'); // 'sport' | 'team'
  const [sport, setSport] = useState(null);    // 'nhl' | 'pwhl'

  function handlePickSport(id) {
    setSport(id);
    setStep('team');
  }

  function handleBack() {
    setStep('sport');
    setSport(null);
  }

  function handleNHLSelect(abbr) {
    // Save sport choice then team, then let caller reload
    localStorage.setItem('eyewall:sport', 'nhl');
    setTeamConfig(abbr);
    onSelect?.(abbr);
  }

  function handlePWHLSelect(abbr) {
    // Save sport choice and PWHL team, then reload
    // Full reload ensures SportContext re-reads localStorage
    localStorage.setItem('eyewall:sport', 'pwhl');
    localStorage.setItem('eyewall:pwhl_team', JSON.stringify(pwhlTeamByAbbr[abbr]));
    // Also set a minimal NHL team config so hasTeamConfig() doesn't re-show
    // the picker on reload — PWHL mode has its own team check via hasPWHLTeamConfig()
    // TODO: decouple hasTeamConfig() from PWHL flow in a future session
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
