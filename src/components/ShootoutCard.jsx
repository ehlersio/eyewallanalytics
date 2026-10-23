// components/ShootoutCard.jsx
// An NHL shootout, shooter by shooter: one row per team (the game team's
// first), each attempt a headshot ringed by how it ended. Takes the live
// rink's place while the shootout is on -- every attempt is at center ice
// at 0:00, so the rink has nothing to plot -- and sits under the score
// bar once the game is over. Read from the play-by-play (nhlShootout.js).
//
// teamId is the game team (useGameTeam(), as the game has it), not
// TEAM_CONFIG, so a guest game view reads it from the guest's side.

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shootoutSummary, shootoutScoreFor, missReasonLabel } from '../utils/nhlShootout';

const HEADER_CLASSES = 'sec-label flex items-center justify-between gap-2';
// A child of .sec-label (unlayered CSS), so these utilities do apply.
const STATUS_CLASSES = 'font-[family-name:var(--font-mono)] text-[11px] font-medium normal-case tracking-normal text-[color:var(--text-muted)]';
const ROW_CLASSES = 'mb-3 last:mb-0';
const ROW_HEADER_CLASSES = 'text-[11px] font-semibold mb-1.5';
const ROW_GOALIE_CLASSES = 'font-normal text-[color:var(--text-muted)]';
// flex-wrap: a long shootout wraps onto more lines on a phone.
const ATTEMPTS_CLASSES = 'flex flex-wrap gap-x-1 gap-y-2';
const ATTEMPT_BASE = 'flex flex-col items-center gap-1 w-[48px] py-1 rounded-[var(--radius-sm)] min-h-0 min-w-0 [transition:background_0.15s]';
const attemptClasses = (selected) => `${ATTEMPT_BASE} ${selected ? 'bg-[var(--bg3)]' : 'hover:bg-[var(--bg3)]'}`;
const AVATAR_WRAP_CLASSES = 'relative inline-flex w-[30px] h-[30px] shrink-0';
const AVATAR_BASE = 'flex items-center justify-center w-full h-full rounded-full overflow-hidden bg-[var(--bg3)] border-2';
// How the attempt ended, at a glance: a goal green, a save grey, a miss
// amber, and a shooter who never got a shot off amber and dashed.
const RING_CLASSES = {
  goal:   'border-solid border-[color:var(--green)]',
  save:   'border-solid border-[color:var(--text-dim)]',
  miss:   'border-solid border-[color:var(--amber)]',
  noShot: 'border-dashed border-[color:var(--amber)]',
};
const NEXT_SLOT_CLASSES = `${AVATAR_BASE} border-dashed border-[color:var(--text-dim)] bg-transparent`;
const CHECK_CLASSES = 'absolute -bottom-[2px] -right-[3px] flex items-center justify-center w-[13px] h-[13px] rounded-full bg-[var(--green)] text-[8px] font-bold leading-none text-white';
const INITIALS_CLASSES = 'text-[10px] font-semibold text-[color:var(--text-muted)]';
const LABEL_BASE = 'text-[10px] leading-[1.2] text-center';
const labelClasses = (result) => `${LABEL_BASE} ${result === 'goal' ? 'text-[color:var(--green)] font-semibold'
  : result === 'save' ? 'text-[color:var(--text-muted)]' : 'text-[color:var(--amber)]'}`;
const REASON_CLASSES = 'block text-[9px] text-[color:var(--text-dim)]';
const GWG_CLASSES = 'ml-0.5 px-[3px] rounded-[3px] bg-[rgba(61,186,126,0.15)] text-[8px] font-bold tracking-[0.04em]';
const DETAIL_CLASSES = 'mt-2 pt-2 border-t-[0.5px] border-[color:var(--border)] text-[11px] text-[color:var(--text-muted)]';

// Tapping the selected attempt again clears it.
export const nextSelection = (current, id) => (current === id ? null : id);

const initials = name => (name || '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

function Avatar({ attempt }) {
  const [failed, setFailed] = useState(false);
  const photo = attempt.shooterHeadshot && !failed;
  return (
    <span className={AVATAR_WRAP_CLASSES}>
      <span className={`${AVATAR_BASE} ${RING_CLASSES[attempt.result]}`}>
        {photo
          ? <img src={attempt.shooterHeadshot} alt={attempt.shooterName || ''} loading="lazy"
              className="w-full h-full object-cover" onError={() => setFailed(true)} />
          : <span className={INITIALS_CLASSES} aria-hidden="true">{initials(attempt.shooterName)}</span>}
      </span>
      {attempt.result === 'goal' && <span className={CHECK_CLASSES} aria-hidden="true">✓</span>}
    </span>
  );
}

function Attempt({ attempt, selected, onToggle }) {
  const { t } = useTranslation();
  const result = t(`shotMapView.shootout.result.${attempt.result}`);
  const reason = attempt.result === 'miss' ? missReasonLabel(attempt.reason, t, { short: true }) : null;
  return (
    <button type="button" className={attemptClasses(selected)} aria-pressed={selected}
      aria-label={attempt.shooterName ? t('shotMapView.shootout.attemptLabel', { name: attempt.shooterName, result }) : result}
      onClick={() => onToggle?.(attempt.eventId)}>
      <Avatar attempt={attempt} />
      <span className={labelClasses(attempt.result)}>
        {result}
        {attempt.gameWinner && <span className={GWG_CLASSES}>{t('shotMapView.shootout.gwg')}</span>}
        {reason && <span className={REASON_CLASSES}>{reason}</span>}
      </span>
    </button>
  );
}

function NextSlot() {
  const { t } = useTranslation();
  const label = t('shotMapView.shootout.nextShooter');
  return (
    <span className={`${ATTEMPT_BASE} shootout-next`} role="img" aria-label={label} title={label}>
      <span className={AVATAR_WRAP_CLASSES}><span className={NEXT_SLOT_CLASSES} /></span>
    </span>
  );
}

// "Connor McDavid · wrist · Save · vs Brandon Bussi" -- whatever the feed has.
export function attemptDetail(attempt, t) {
  if (!attempt) return null;
  const parts = [
    attempt.shooterName,
    attempt.shotType,
    t(`shotMapView.shootout.result.${attempt.result}`),
    attempt.result === 'miss' ? missReasonLabel(attempt.reason, t) : null,
    attempt.goalieName ? t('shotMapView.shootout.vsGoalie', { name: attempt.goalieName }) : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

// The card itself, with the selection handed in (ShootoutCard keeps it).
export function ShootoutCardBody({ pbp, teamId, teamAbbr, oppAbbr, oppColor, isLive, selectedId = null, onToggle }) {
  const { t } = useTranslation();
  const summary = useMemo(() => shootoutSummary(pbp), [pbp]);
  if (!summary.isShootout) return null;

  const oppId = [pbp?.homeTeam?.id, pbp?.awayTeam?.id].find(id => id != null && id !== teamId) ?? null;
  const score = shootoutScoreFor(summary, teamId);
  let status = null;
  if (!summary.complete) {
    // Before the first attempt it's round 1 that's under way, not round 0.
    status = t('shotMapView.scoreBar.shootoutTally', { car: score.team, opp: score.opp, round: Math.max(1, summary.round) });
  } else if (summary.winnerTeamId != null) {
    const won = summary.winnerTeamId === teamId;
    status = t('shotMapView.shootout.statusFinal', {
      abbr: won ? teamAbbr : oppAbbr,
      x: Math.max(score.team, score.opp),
      y: Math.min(score.team, score.opp),
    });
  }

  const rows = [
    { id: teamId, abbr: teamAbbr, color: 'var(--team-primary)' },
    { id: oppId, abbr: oppAbbr, color: oppColor || 'var(--text-muted)' },
  ];
  const showNext = isLive && !summary.complete && summary.nextTeamId != null;
  const selected = summary.attempts.find(a => a.eventId === selectedId) || null;

  return (
    <div className="card" data-testid="shootout-card">
      <div className={HEADER_CLASSES}>
        <span>{t('shotMapView.shootout.title')}</span>
        {status && <span className={STATUS_CLASSES}>{status}</span>}
      </div>
      {rows.map(row => {
        const goalie = row.id != null ? summary.goalieFor[row.id]?.name : null;
        const attempts = row.id != null ? (summary.byTeam[row.id] || []) : [];
        return (
          <div key={row.id ?? row.abbr} className={ROW_CLASSES} data-team={row.abbr}>
            <div className={ROW_HEADER_CLASSES}>
              <span style={{ color: row.color }}>{row.abbr}</span>
              {goalie && <span className={ROW_GOALIE_CLASSES}> · {t('shotMapView.shootout.goalieInNet', { name: goalie })}</span>}
            </div>
            <div className={ATTEMPTS_CLASSES}>
              {attempts.map(a => (
                <Attempt key={a.eventId} attempt={a} selected={a.eventId === selectedId} onToggle={onToggle} />
              ))}
              {showNext && summary.nextTeamId === row.id && <NextSlot />}
            </div>
          </div>
        );
      })}
      {selected && <div className={DETAIL_CLASSES} aria-live="polite">{attemptDetail(selected, t)}</div>}
    </div>
  );
}

export default function ShootoutCard(props) {
  const [selectedId, setSelectedId] = useState(null);
  return (
    <ShootoutCardBody {...props} selectedId={selectedId}
      onToggle={id => setSelectedId(cur => nextSelection(cur, id))} />
  );
}
