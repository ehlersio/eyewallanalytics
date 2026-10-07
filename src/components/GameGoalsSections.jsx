// components/GameGoalsSections.jsx
// "Goals" and "Penalty shots" sections for the PWHL/AHL/ECHL game-stats
// popups (contract C6), from the Worker's /{league}/game-box `goals` and
// `penaltyShots` arrays:
//   goals:        [{ period, time, team_id, scorer_id, scorer_name,
//                    assist_ids[], plus_player_ids[], minus_player_ids[],
//                    strength }]   ({league}_goal_on_ice)
//   penaltyShots: [{ period, time, team_id, shooter_id, shooter_name,
//                    goalie_id, result }]  ({league}_penalty_shots)
// Each section renders only when its array is non-empty (empty until the
// pipeline backfills). Players are named from the box score's name map
// (boxScoreNames), else "#jersey" from the box rows, else "—". The feed
// can't tell a saved penalty shot from a miss, so a non-goal reads
// "No goal".
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const SECTION_LABEL_CLASSES = 'pgs-section-label font-[family-name:var(--font-display)] text-[9px] font-bold tracking-[0.12em] uppercase text-[color:var(--text-dim)] pb-1.5 border-b-[0.5px] border-b-[color:var(--border)] mb-2';
const ROW_CLASSES = 'flex items-start gap-2 py-1.5 border-b-[0.5px] border-b-[color:var(--border)] text-[12px]';
const WHEN_CLASSES = 'font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--text-dim)] w-[64px] shrink-0';
const TEAM_CLASSES = 'font-[family-name:var(--font-display)] text-[11px] font-bold w-[36px] shrink-0';
const SUB_CLASSES = 'text-[11px] text-[color:var(--text-muted)]';
const TAG_CLASSES = 'text-[9px] font-bold uppercase tracking-[0.06em] py-[1px] px-[5px] rounded-[6px] bg-[var(--bg3)] text-[color:var(--text-muted)] ml-1.5 align-middle';
const LINK_CLASSES = 'text-[10px] text-[color:var(--text-dim)] underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0 mt-0.5';

export function goalPeriodLabel(n) {
  if (!n) return '—';
  if (n <= 3) return `P${n}`;
  return n === 4 ? 'OT' : `OT${n - 3}`;
}

// player_id -> display name: the box score's name map, else "#jersey" from
// the box rows, else "—".
export function playerLabeler(names, box) {
  const jerseys = {};
  [...(box?.skaters || []), ...(box?.goalies || [])].forEach(r => {
    if (r.jersey_number != null) jerseys[r.player_id] = r.jersey_number;
  });
  return id => {
    if (id == null) return '—';
    if (names?.[id]) return names[id];
    return jerseys[id] != null ? `#${jerseys[id]}` : '—';
  };
}

function useTeamSide({ teamId, abbr, oppAbbr, color, oppColor }) {
  return tid => tid === teamId ? { abbr, color } : { abbr: oppAbbr, color: oppColor };
}

function GoalRow({ goal, label, side }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { abbr, color } = side(goal.team_id);
  const assists = (goal.assist_ids || []).map(label).filter(n => n !== '—');
  const plus = goal.plus_player_ids || [];
  const minus = goal.minus_player_ids || [];
  const hasOnIce = plus.length > 0 || minus.length > 0;
  return (
    <div className={`${ROW_CLASSES} pgs-goal-row`}>
      <span className={WHEN_CLASSES}>{goalPeriodLabel(goal.period)} {goal.time || ''}</span>
      <span className={TEAM_CLASSES} style={{ color }}>{abbr}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[color:var(--text)]">
          {goal.scorer_name || label(goal.scorer_id)}
          {goal.strength && goal.strength !== 'EV' && (
            <span className={TAG_CLASSES}>{t(`gameGoals.strength.${goal.strength}`, { defaultValue: goal.strength })}</span>
          )}
        </div>
        <div className={SUB_CLASSES}>
          {assists.length ? t('gameGoals.assists', { names: assists.join(', ') }) : t('gameStatsPopup.goals.unassisted')}
        </div>
        {hasOnIce && (
          <>
            <button type="button" className={LINK_CLASSES} onClick={() => setOpen(o => !o)} aria-expanded={open}>
              {open ? t('gameGoals.hideOnIce') : t('gameGoals.showOnIce')}
            </button>
            {open && (
              <div className={`${SUB_CLASSES} pgs-on-ice mt-0.5`}>
                {plus.length > 0 && <div>{t('gameGoals.onIceFor', { names: plus.map(label).join(', ') })}</div>}
                {minus.length > 0 && <div>{t('gameGoals.onIceAgainst', { names: minus.map(label).join(', ') })}</div>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function GoalsSection({ goals, label, ...teams }) {
  const { t } = useTranslation();
  const side = useTeamSide(teams);
  if (!goals?.length) return null;
  return (
    <div className="pgs-section pgs-goals mt-4.5" data-testid="game-goals">
      <div className={SECTION_LABEL_CLASSES}>{t('gameGoals.title')}</div>
      {goals.map((g, i) => <GoalRow key={`${g.period}-${g.time}-${i}`} goal={g} label={label} side={side} />)}
    </div>
  );
}

export function PenaltyShotsSection({ penaltyShots, label, ...teams }) {
  const { t } = useTranslation();
  const side = useTeamSide(teams);
  if (!penaltyShots?.length) return null;
  return (
    <div className="pgs-section pgs-penalty-shots mt-4.5" data-testid="game-penalty-shots">
      <div className={SECTION_LABEL_CLASSES}>{t('gameGoals.penaltyShotsTitle')}</div>
      {penaltyShots.map((ps, i) => {
        const { abbr, color } = side(ps.team_id);
        const scored = ps.result === 'goal';
        return (
          <div key={`${ps.period}-${ps.time}-${i}`} className={ROW_CLASSES}>
            <span className={WHEN_CLASSES}>{goalPeriodLabel(ps.period)} {ps.time || ''}</span>
            <span className={TEAM_CLASSES} style={{ color }}>{abbr}</span>
            <div className="flex-1 min-w-0 text-[color:var(--text)]">
              {ps.shooter_name || label(ps.shooter_id)}
              {ps.goalie_id != null && <span className={SUB_CLASSES}> {t('gameGoals.vsGoalie', { name: label(ps.goalie_id) })}</span>}
            </div>
            <span className={`text-[11px] font-semibold ${scored ? 'text-[color:var(--green)]' : 'text-[color:var(--text-muted)]'}`}>
              {scored ? t('gameGoals.psGoal') : t('gameGoals.psNoGoal')}
            </span>
          </div>
        );
      })}
    </div>
  );
}
