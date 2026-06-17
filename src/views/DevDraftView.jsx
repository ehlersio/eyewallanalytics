/**
 * DevDraftView.jsx — Draft simulator for development/testing only.
 * Accessible at /dev/draft in DEV mode.
 *
 * Simulates all three draft states:
 *   Pre-draft  — Rankings board only, no picks
 *   In-progress — Picks feed in one at a time (play/pause/step)
 *   Complete    — All fixture picks shown
 *
 * Also lets you switch teams to test PicksTab for any team.
 *
 * Uses override props on DraftTab and PicksTab — no real API calls.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import DraftTab from '../components/DraftTab';
import { PicksTabDev } from './TeamView';
import {
  FIXTURE_RANKINGS,
  FIXTURE_ORDER,
  FIXTURE_PICKS_SEQUENCE,
  getPicksForTeam,
  getOrderForTeam,
} from '../utils/draftFixtures';
import '../components/DraftTab.css';

const TEAMS = [
  'CAR', 'TOR', 'SJS', 'VAN', 'CHI', 'NYR', 'CGY', 'SEA',
  'WPG', 'FLA', 'NSH', 'STL', 'BOS', 'EDM', 'MTL', 'OTT',
];

const STATES = ['pre-draft', 'in-progress', 'complete'];
const SPEED_OPTIONS = [
  { label: '0.5s', ms: 500 },
  { label: '1s',   ms: 1000 },
  { label: '2s',   ms: 2000 },
  { label: '5s',   ms: 5000 },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  shell: {
    minHeight: '100vh',
    background: 'var(--bg1, #141414)',
    color: 'var(--text, #e8e8e8)',
    fontFamily: 'var(--font, system-ui, sans-serif)',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '0.5px solid var(--border, rgba(255,255,255,0.08))',
    background: 'var(--bg2, #1e1e1e)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--red-bright, #e84040)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginRight: 8,
  },
  label: {
    fontSize: 11,
    color: 'var(--text-dim, #666)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginRight: 4,
  },
  select: {
    fontSize: 12,
    padding: '4px 8px',
    borderRadius: 6,
    border: '0.5px solid var(--border, rgba(255,255,255,0.1))',
    background: 'var(--bg3, #252525)',
    color: 'var(--text, #e8e8e8)',
    cursor: 'pointer',
  },
  btn: (active) => ({
    padding: '4px 12px',
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: '0.5px solid',
    transition: 'all 0.15s',
    background: active ? 'var(--red-dim, rgba(232,64,64,0.15))' : 'transparent',
    color: active ? 'var(--red-bright, #e84040)' : 'var(--text-muted, #999)',
    borderColor: active ? 'var(--red-border, rgba(232,64,64,0.3))' : 'var(--border, rgba(255,255,255,0.1))',
  }),
  counter: {
    fontSize: 11,
    color: 'var(--text-dim, #666)',
    fontVariantNumeric: 'tabular-nums',
  },
  content: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '16px 12px',
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text-dim, #666)',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '0.5px solid var(--border, rgba(255,255,255,0.06))',
  },
  divider: {
    height: 1,
    background: 'var(--border, rgba(255,255,255,0.06))',
    margin: '20px 0',
  },
};

// ─── DevDraftView ─────────────────────────────────────────────────────────────

export default function DevDraftView() {
  const [draftState, setDraftState] = useState('pre-draft');
  const [teamAbbr, setTeamAbbr]     = useState('CAR');
  const [pickIndex, setPickIndex]   = useState(0); // how many picks revealed so far
  const [playing, setPlaying]       = useState(false);
  const [speed, setSpeed]           = useState(2000);
  const intervalRef = useRef(null);

  // Derive pick list from state
  const activePicks = draftState === 'pre-draft'   ? []
    : draftState === 'complete'  ? FIXTURE_PICKS_SEQUENCE
    : FIXTURE_PICKS_SEQUENCE.slice(0, pickIndex);

  const teamPicks = getPicksForTeam(teamAbbr);
  const teamOrder = getOrderForTeam(teamAbbr);

  const totalPicks = FIXTURE_PICKS_SEQUENCE.length;

  // Play/pause logic
  const advance = useCallback(() => {
    setPickIndex(i => {
      if (i >= totalPicks) {
        setPlaying(false);
        return i;
      }
      return i + 1;
    });
  }, [totalPicks]);

  useEffect(() => {
    if (playing && draftState === 'in-progress') {
      intervalRef.current = setInterval(advance, speed);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, speed, advance, draftState]);

  // When pick index reaches end, stop playing
  useEffect(() => {
    if (pickIndex >= totalPicks) setPlaying(false);
  }, [pickIndex, totalPicks]);

  // Reset when state changes
  useEffect(() => {
    setPlaying(false);
    setPickIndex(0);
  }, [draftState]);

  // Picks for this team in active pick list
  const activeTeamPicks = activePicks.filter(p => p.team_abbrev === teamAbbr);
  const activeTeamOrder = draftState === 'pre-draft'
    ? teamOrder
    : teamOrder.filter(slot => !activePicks.find(p => p.pick_overall === slot.pick_overall));

  return (
    <div style={S.shell}>
      {/* ── Controls header ── */}
      <div style={S.header}>
        <span style={S.title}>🏒 Draft Simulator</span>

        {/* Draft state */}
        <span style={S.label}>State</span>
        {STATES.map(s => (
          <button key={s} style={S.btn(draftState === s)} onClick={() => setDraftState(s)}>
            {s === 'pre-draft' ? 'Pre-draft' : s === 'in-progress' ? 'Live' : 'Complete'}
          </button>
        ))}

        <span style={{ flex: 1 }} />

        {/* Team picker */}
        <span style={S.label}>Team</span>
        <select style={S.select} value={teamAbbr} onChange={e => setTeamAbbr(e.target.value)}>
          {TEAMS.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* ── Live draft playback controls ── */}
      {draftState === 'in-progress' && (
        <div style={{ ...S.header, borderTop: 'none', gap: 10 }}>
          <button
            style={S.btn(false)}
            onClick={() => setPickIndex(0)}
            title="Reset to 0 picks"
          >↩ Reset</button>

          <button
            style={S.btn(playing)}
            onClick={() => setPlaying(p => !p)}
          >{playing ? '⏸ Pause' : '▶ Play'}</button>

          <button
            style={S.btn(false)}
            onClick={advance}
            disabled={pickIndex >= totalPicks}
          >→ Step</button>

          <button
            style={S.btn(false)}
            onClick={() => setPickIndex(totalPicks)}
          >⏭ All picks</button>

          <span style={S.label}>Speed</span>
          {SPEED_OPTIONS.map(o => (
            <button key={o.ms} style={S.btn(speed === o.ms)} onClick={() => setSpeed(o.ms)}>
              {o.label}
            </button>
          ))}

          <span style={S.counter}>
            {pickIndex} / {totalPicks} picks
            {pickIndex >= totalPicks ? ' · Complete' : playing ? ' · Live…' : ' · Paused'}
          </span>
        </div>
      )}

      <div style={S.content}>
        {/* ── League Draft Tab ── */}
        <div style={S.section}>
          <div style={S.sectionLabel}>League → Draft tab</div>
          <DraftTab
            overrideRankings={FIXTURE_RANKINGS}
            overridePicks={activePicks}
          />
        </div>

        <div style={S.divider} />

        {/* ── Team Picks Tab ── */}
        <div style={S.section}>
          <div style={S.sectionLabel}>Team → Picks tab ({teamAbbr})</div>
          <PicksTabDev
            teamAbbr={teamAbbr}
            overridePicks={activeTeamPicks}
            overrideOrder={activeTeamOrder}
          />
        </div>
      </div>
    </div>
  );
}
