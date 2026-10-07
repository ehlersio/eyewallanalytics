// components/PlayerRankBanner.jsx
// The player popups' "Ranked by …" banner: rows of ordinal rank badges
// ("3rd · League"). Moved out of PlayerPopup.jsx (NHL) so the PWHL/AHL/ECHL
// popup (HockeyTechPlayerPopup.jsx) shows the same thing.
//
//   <PlayerRankBanner rows={[{ label: 'Ranked by points', badges: [{ scope: 'League', rank: 3 }] }]} />
//
// A badge without a rank, and a row without badges, aren't drawn; no rows,
// no banner.
import { formatOrdinal } from '../utils/formatters'

const PP_RANKINGS_CLASSES = 'flex flex-col items-center gap-2 py-3 px-4 bg-[var(--bg2)] border-b-[0.5px] border-[var(--border)] text-center'
const PP_RANK_LABEL_CLASSES = 'text-[10px] text-[color:var(--text-dim)] uppercase tracking-[0.08em] font-[family-name:var(--font-display)] font-semibold'
const PP_RANK_ITEMS_CLASSES = 'flex gap-6 justify-center flex-wrap'
const RANK_BADGE_CLASSES = 'flex flex-col items-center gap-[2px]'
const RANK_NUM_CLASSES = 'font-[family-name:var(--font-display)] text-[22px] font-bold leading-none'
const RANK_SCOPE_CLASSES = 'text-[10px] text-[color:var(--text-dim)] uppercase tracking-[0.06em]'

export function RankBadge({ label, rank }) {
  const color  = rank <= 3 ? 'var(--green)' : rank <= 10 ? 'var(--amber)' : 'var(--text-muted)'
  return (
    <div className={RANK_BADGE_CLASSES}>
      <span className={RANK_NUM_CLASSES} style={{ color }}>{formatOrdinal(rank)}</span>
      <span className={RANK_SCOPE_CLASSES}>{label}</span>
    </div>
  )
}

export default function PlayerRankBanner({ rows, testId }) {
  const shown = (rows || [])
    .map(r => ({ ...r, badges: (r.badges || []).filter(b => b.rank) }))
    .filter(r => r.badges.length)
  if (!shown.length) return null
  return (
    <div className={PP_RANKINGS_CLASSES} data-testid={testId}>
      {shown.map((r, i) => (
        <div key={r.label} style={{ display: 'contents' }}>
          <span className={PP_RANK_LABEL_CLASSES} style={i ? { marginTop: 8 } : undefined}>{r.label}</span>
          <div className={PP_RANK_ITEMS_CLASSES}>
            {r.badges.map(b => <RankBadge key={b.scope} label={b.scope} rank={b.rank} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
