// src/components/TeamPicker.jsx
// Full-screen team picker — shown on first launch (no saved team) and
// when the user wants to switch teams from the settings popup.
//
// Usage:
//   <TeamPicker onSelect={abbr => { /* reload or update state */ }} />
//
// After the user taps a team, this calls setTeamConfig() then onSelect().
// The caller decides whether to reload the page (first launch) or just
// update local state (settings change — though a reload is simplest).

import { useState } from 'react'
import { ALL_TEAMS, setTeamConfig } from '../utils/teamConfig'
import TeamLogo from './TeamLogo'
import { TEAM_COLORS } from '../utils/nhlApi'
import './TeamPicker.css'

// Grouped for the picker grid — mirrors NHL division structure
const DIVISIONS = [
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

const teamByAbbr = Object.fromEntries(ALL_TEAMS.map(t => [t.abbr, t]));

export default function TeamPicker({ onSelect }) {
  const [hovered, setHovered] = useState(null);

  function handleSelect(abbr) {
    setTeamConfig(abbr);
    onSelect?.(abbr);
  }

  return (
    <div className="team-picker-overlay">
      <div className="team-picker-inner">
        <div className="team-picker-header">
          <h1 className="team-picker-title">Choose your team</h1>
          <p className="team-picker-sub">You can change this any time from settings.</p>
        </div>

        <div className="team-picker-divisions">
          {DIVISIONS.map(division => (
            <div key={division.name} className="team-picker-division">
              <span className="team-picker-division-label">{division.name}</span>
              <div className="team-picker-grid">
                {division.teams.map(abbr => {
                  const team  = teamByAbbr[abbr];
                  const color = TEAM_COLORS[abbr] || '#888';
                  const isHov = hovered === abbr;
                  if (!team) return null;
                  return (
                    <button
                      key={abbr}
                      className="team-picker-tile"
                      style={{
                        '--team-color': color,
                        background: isHov ? `${color}22` : 'transparent',
                        borderColor: isHov ? color : 'var(--border)',
                      }}
                      onClick={() => handleSelect(abbr)}
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
      </div>      
    </div>
  );
}
