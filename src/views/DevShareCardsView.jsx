// DevShareCardsView.jsx -- dev-only gallery of every share card (/dev/share-cards).
//
// Renders each export card with fixed sample data so the ShareCardFrame
// look can be reviewed without waiting for a live game, and each card can
// be exported exactly as a user would (Export PNG runs the same html-to-
// image path as useShareCard). Never bundled into production builds --
// App.jsx only imports it under import.meta.env.DEV.

import { useEffect, useRef, useState } from 'react';
import { renderToPng } from '../hooks/useShareCard';
import { PredictionCanvas } from '../components/PredictionShareCanvas';
import { PWHLPredictionCanvas } from '../components/PWHLPredictionShareCanvas';
import PeriodSummaryShareCanvas from '../components/PeriodSummaryShareCanvas';
import { ScoutingShareCanvas } from '../components/ScoutingTab';
import { PowerRankingsCanvas } from './LeagueView';
import { SHARE_W, SHARE_H } from '../utils/shareCardTheme';

const SCALE = 0.5;

const PREDICTION = {
  carModelPct: 62, predCarScore: 3.4, predOppScore: 2.6,
  carGpg: 3.55, oppGpg: 2.98, carGag: 2.88, oppGag: 3.12, carWin: 0.646, oppWin: 0.512, carPP: 24.9, oppPK: 78.4,
  factors: [
    { label: 'Goals for per game', carEdge: true },
    { label: 'Shot suppression', carEdge: true },
    { label: 'Goaltending (SV%)', carEdge: false },
    { label: 'Recent form (L10)', carEdge: true },
    { label: 'Special teams', carEdge: false },
  ],
  oppAbbr: 'NYI', oppColor: '#649cff', isPlayoff: false, seriesEntry: null,
  aiNarrative: 'Carolina controls play at five-on-five better than almost anyone, and the Islanders have struggled to generate chances against structured forechecks. The Hurricanes power play has been clicking at nearly 25%, while New York sits in the bottom third on the penalty kill. Expect Carolina to lean on possession and wear the Islanders down over sixty minutes.',
};


const NARRATIVE = 'Carolina controlled the middle frame, outshooting New York 14-6 and turning a one-goal lead into a comfortable cushion. Andrei Svechnikov converted on the power play, and the Hurricanes limited the Islanders to two high-danger looks all period.';

const goal = (isCar, scorerName, period, time, strength = 'ev') => ({ isCar, scorerName, period, time, strength });
const SUMMARY_BASE = {
  corsiForPct: 58.2, fenwickForPct: 56.9, carSOG: 31, oppSOG: 22, carHits: 18, carFOPct: 54, carHDCF: 11, oppHDCF: 6,
  homeScore: 4, awayScore: 2, carTK: 7, carGV: 4,
  penalties: [{ isCar: true }, { isCar: false }, { isCar: false }],
};
const GAME_SUMMARY = {
  ...SUMMARY_BASE, isGameSummary: true, periodLabel: 'Final',
  goals: [goal(true, 'Sebastian Aho', 1, '4:12'), goal(false, 'Mathew Barzal', 1, '15:40', 'pp'), goal(true, 'Andrei Svechnikov', 2, '8:03', 'pp'),
    goal(true, 'Seth Jarvis', 2, '17:55'), goal(false, 'Bo Horvat', 3, '6:21'), goal(true, 'Jordan Staal', 3, '19:02', 'sh')],
  threeStars: [
    { name: { default: 'Andrei Svechnikov' }, teamAbbrev: { default: 'CAR' } },
    { name: { default: 'Frederik Andersen' }, teamAbbrev: { default: 'CAR' } },
    { name: { default: 'Mathew Barzal' }, teamAbbrev: { default: 'NYI' } },
  ],
};
const PERIOD_SUMMARY = {
  ...SUMMARY_BASE, isGameSummary: false, periodLabel: '2nd Period', homeScore: 3, awayScore: 1,
  goals: [goal(true, 'Andrei Svechnikov', 2, '8:03', 'pp'), goal(true, 'Seth Jarvis', 2, '17:55')],
};
const SUMMARY_STATS = [
  { val: '58.2%', label: 'CAR CF%', color: 'good' }, { val: '31–22', label: 'Shots on goal' },
  { val: '56.9%', label: 'CAR FF%', color: 'good' }, { val: 18, label: 'CAR hits' },
  { val: '54%', label: 'Faceoff win %' }, { val: '11–6', label: 'High-danger chances', color: 'good' },
];
const SUMMARY_PROPS = {
  carAbbr: 'CAR', oppAbbr: 'NYI', carScore: 4, oppScore: 2, carColor: '#ff0f0f', oppColor: '#649cff',
  stats: SUMMARY_STATS, strengthOf: g => g.strength, headshotUrl: () => null, narrative: NARRATIVE, note: 'Stats: NHL · EyeWall',
  insights: [{ good: true, text: '↑ CAR dominated possession' }, { text: 'Penalties: CAR 1, NYI 2' }, { good: true, text: '✓ 7 takeaways, 4 giveaways' }],
};

const skaters = names => names.map((name, i) => ({ name, points: 88 - i * 9 }));
const SCOUTING = {
  carStats: { goalsForPerGame: 3.55, goalsAgainstPerGame: 2.88, powerPlayPct: 0.249, penaltyKillPct: 0.805, shotsForPerGame: 32.2 },
  oppStats: { goalsForPerGame: 2.98, goalsAgainstPerGame: 3.12, powerPlayPct: 0.178, penaltyKillPct: 0.784, shotsForPerGame: 28.4 },
  carPlayers: { skaters: skaters(['Sebastian Aho', 'Andrei Svechnikov', 'Seth Jarvis', 'Martin Necas']), goalies: [{ name: 'Frederik Andersen', wins: 31, gaa: 2.41, savePct: 0.912 }] },
  oppPlayers: { skaters: skaters(['Mathew Barzal', 'Bo Horvat', 'Noah Dobson', 'Anders Lee']), goalies: [{ name: 'Ilya Sorokin', wins: 28, gaa: 2.78, savePct: 0.905 }] },
  oppAbbr: 'NYI', oppColor: '#649cff', isPlayoff: false, matchupText: NARRATIVE,
  carLines: { lines: [
    { xgfPct: 58.4, players: [{ pos: 'L', name: 'Andrei Svechnikov' }, { pos: 'C', name: 'Sebastian Aho' }, { pos: 'R', name: 'Seth Jarvis' }] },
    { xgfPct: 47.1, players: [{ pos: 'L', name: 'Jordan Martinook' }, { pos: 'C', name: 'Jordan Staal' }, { pos: 'R', name: 'Jesperi Kotkaniemi' }] },
  ] },
};

const ABBRS = ['FLA', 'WPG', 'DAL', 'CAR', 'VGK', 'WSH', 'COL', 'TOR', 'EDM', 'LAK', 'TBL', 'NJD', 'OTT', 'MIN', 'STL', 'NYR'];
const RANKED = ABBRS.map((abbr, i) => ({
  abbr, rank: i + 1, wins: 54 - i * 2, losses: 20 + i, otLosses: 8 - (i % 4), ptsPct: 0.70 - i * 0.015,
  xgfPct: 0.56 - i * 0.006, gdPG: 0.9 - i * 0.12, l10: `${7 - (i % 4)}-${2 + (i % 3)}-1`,
}));
const RANKINGS = {
  ranked: RANKED,
  myTeam: { ...RANKED[3], l10PtsPct: 0.65, spPct: 1.008, leagueRanks: { pts: 4, l10: 6, xgf: 2, gd: 5, sp: 14 } },
  priorRank: 6, narrative: NARRATIVE, primaryColor: '#ff0f0f',
};

// Flags a card whose content is taller than the frame leaves room for.
function OverflowFlag({ slot }) {
  const [over, setOver] = useState(null);
  useEffect(() => {
    const id = setTimeout(() => {
      const content = slot.current?.querySelector('.share-card-canvas')?.children?.[3];
      if (content) setOver(content.scrollHeight - content.clientHeight);
    }, 1500);
    return () => clearTimeout(id);
  });
  if (over == null) return null;
  return <span data-overflow={over} style={{ color: over > 0 ? '#f87171' : '#4ade80' }}>{over > 0 ? `OVERFLOW ${over}px` : 'fits'}</span>;
}

function CardSlot({ name, children }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const exportPng = async () => {
    const node = ref.current?.querySelector('.share-card-canvas');
    if (!node) return;
    setBusy(true);
    try {
      const url = await renderToPng(node);
      const a = document.createElement('a');
      a.download = `share-card-${name}.png`;
      a.href = url;
      a.click();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: 'inline-block', margin: 12, verticalAlign: 'top' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
        <strong>{name}</strong>
        <OverflowFlag slot={ref} />
        <button type="button" onClick={exportPng} disabled={busy}>{busy ? '…' : 'Export PNG'}</button>
      </div>
      <div ref={ref} className="dev-share-slot" data-card={name}
        style={{ width: SHARE_W * SCALE, height: SHARE_H * SCALE, overflow: 'hidden', position: 'relative' }}>
        <div style={{ transform: `scale(${SCALE})`, transformOrigin: 'top left', width: SHARE_W, height: SHARE_H }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function DevShareCardsView() {
  return (
    <div style={{ padding: 16 }}>
      {/* Pull the off-screen canvases into the page for review. */}
      <style>{'.dev-share-slot .share-card-canvas{position:relative!important;left:0!important;z-index:auto!important;}'}</style>
      <h2 style={{ margin: '0 12px' }}>Share cards (dev)</h2>
      <CardSlot name="nhl-prediction"><PredictionCanvas {...PREDICTION} /></CardSlot>
      <CardSlot name="nhl-prediction-playoff">
        <PredictionCanvas {...PREDICTION} isPlayoff seriesEntry={{ carWins: 2, oppWins: 1 }} aiNarrative={null} />
      </CardSlot>
      <CardSlot name="pwhl-prediction">
        <PWHLPredictionCanvas abbr="MIN" oppAbbr="BOS" color="#9d7ae1" oppColor="#4c9a73" myWinPct={57} oppWinPct={43}
          myExp={3.1} oppExp={2.4} myStreak="W3" oppStreak="L1" myCorsi={53.4} oppCorsi={46.6} narrative={NARRATIVE} />
      </CardSlot>
      <CardSlot name="game-summary"><PeriodSummaryShareCanvas summary={GAME_SUMMARY} {...SUMMARY_PROPS} /></CardSlot>
      <CardSlot name="game-summary-busiest">
        <PeriodSummaryShareCanvas summary={{ ...GAME_SUMMARY, goals: [
          ...['Aho', 'Aho', 'Aho', 'Svechnikov', 'Jarvis'].map((n, i) => goal(true, `Sebastian ${n}`, 1 + (i % 3), `1${i}:0${i}`, i === 1 ? 'pp' : 'ev')),
          ...['Barzal', 'Horvat', 'Lee', 'Dobson', 'Palmieri'].map((n, i) => goal(false, `Player ${n}`, 1 + (i % 3), `${i + 2}:3${i}`, i === 4 ? 'en' : 'ev')),
        ] }} {...SUMMARY_PROPS} carScore={5} oppScore={5}
          hatTricks={[{ isNatural: false, scorerName: 'Sebastian Aho' }]} />
      </CardSlot>
      <CardSlot name="period-summary"><PeriodSummaryShareCanvas summary={PERIOD_SUMMARY} {...SUMMARY_PROPS} carScore={3} oppScore={1} /></CardSlot>
      <CardSlot name="scouting"><ScoutingShareCanvas {...SCOUTING} /></CardSlot>
      <CardSlot name="power-rankings"><PowerRankingsCanvas {...RANKINGS} /></CardSlot>
      <CardSlot name="power-rankings-outside-top10">
        <PowerRankingsCanvas {...RANKINGS} myTeam={{ ...RANKINGS.myTeam, ...RANKED[13] }} priorRank={11} />
      </CardSlot>
    </div>
  );
}
