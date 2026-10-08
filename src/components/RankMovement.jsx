// components/RankMovement.jsx
// Places a team moved in a power ranking since the run before: ▲2 / ▼1 /
// — (no change); blank with no earlier run. The AHL/ECHL rankings table
// (HockeyTechPowerRankingsPanel) and the PWHL's (PWHLLeagueView), from the
// pipeline's nightly rows.
import { rankMovement } from '../utils/hockeyTechPowerRankings';

const MVMT_CLASSES = 'pr-mvmt text-center text-[10px] font-bold [font-variant-numeric:tabular-nums]';

export default function RankMovement({ rank, priorRank }) {
  const diff = rankMovement(rank, priorRank);
  if (diff == null) return <span className={MVMT_CLASSES} />;
  if (diff === 0) return <span className={`${MVMT_CLASSES} text-[color:var(--text-dim)]`}>—</span>;
  return diff > 0
    ? <span className={`${MVMT_CLASSES} text-[color:var(--green)]`}>▲{diff}</span>
    : <span className={`${MVMT_CLASSES} text-[color:var(--red-bright)]`}>▼{Math.abs(diff)}</span>;
}
