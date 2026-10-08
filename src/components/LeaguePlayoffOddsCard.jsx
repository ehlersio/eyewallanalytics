// components/LeaguePlayoffOddsCard.jsx
// Team › Overview "Playoff odds" for the PWHL, AHL and ECHL (contract
// C10), from /{league}/playoff-odds: eyewall-pipeline's nightly
// hockeytech_playoff_odds.py, the NHL model's counterpart (the rest of the
// regular season simulated from Elo ratings). Same shape as the NHL card in
// TeamView.jsx: chance to make the playoffs (and win the division where
// the league plays in divisions), projected points with the 10th-90th
// percentile range, the season's trend, and the same stale and early-season
// notes. The NHL card's per-game change and next-game-day sections have no
// counterpart in this route.
//
// A season whose playoff format the pipeline hasn't verified from the
// league's own rules (format 'unverified', make_playoffs_pct null -- AHL and
// ECHL 2026-27 as of 2026-10-08) shows projected points only, with a note:
// no guessed format. Hidden when there's no run (or the route can't be
// read).
import { useTranslation } from 'react-i18next';
import { useFetch } from '../hooks/useFetch';
import Sparkline from './Sparkline';
import InfoTip from './InfoTip';
import { formatOddsPct, leagueOddsView } from '../utils/playoffOddsFormat';
import { parseLocalDate } from '../utils/injuryDetails';
import { formatDate } from '../utils/formatters';

const LABEL_CLASSES = 'text-[9px] uppercase tracking-[0.06em] text-[color:var(--text-dim)] mb-[2px]';
const BIG_CLASSES = 'font-[family-name:var(--font-mono)] text-[26px] font-bold leading-none text-[color:var(--text)]';
const MID_CLASSES = 'font-[family-name:var(--font-mono)] text-[17px] font-bold leading-none text-[color:var(--text)]';
const NOTE_CLASSES = 'text-[11px] text-[color:var(--amber)] mb-2';

function formatOddsDate(d) {
  const x = parseLocalDate(d);
  return x ? formatDate(x) : d;
}

// fetchOdds(): the route's answer (deps: useFetch's). leagueKey: 'pwhl' |
// 'ahl' | 'echl', for the league's name in the notes. gamesPlayedFor(season
// id): the team's GP in the season the odds are for, or null when the view
// doesn't have it (then no early-season note).
export default function LeaguePlayoffOddsCard({ fetchOdds, deps, leagueKey, gamesPlayedFor }) {
  const { t } = useTranslation();
  const names = { league: t(`hockeyTechLeagues.${leagueKey}.name`), ofLeague: t(`hockeyTechLeagues.${leagueKey}.of`) };
  const { data } = useFetch(fetchOdds, deps);
  const gamesPlayed = data?.latest ? gamesPlayedFor?.(data.latest.season_id) ?? null : null;
  const view = leagueOddsView(data, gamesPlayed);
  if (!view) return null;
  const { latest, formatKnown, showDivision, stale, early, trend } = view;
  const points = (
    <div className="playoff-odds-points">
      <div className={LABEL_CLASSES}>{t('playoffOdds.projPoints')}</div>
      <div className={formatKnown ? MID_CLASSES : BIG_CLASSES}>
        {latest.proj_points_p50}
        <span className="text-[10px] font-normal text-[color:var(--text-dim)] ml-1">{t('playoffOdds.projRange', { low: latest.proj_points_p10, high: latest.proj_points_p90 })}</span>
      </div>
    </div>
  );

  return (
    <div className="card playoff-odds league-playoff-odds" style={{ marginTop: 10 }}>
      <div className="sec-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        {t('playoffOdds.title')}
        <InfoTip label={t('playoffOdds.title')} text={t('playoffOdds.infoTipLeague', names)} position="above" />
      </div>
      {stale ? (
        <div className={`playoff-odds-stale ${NOTE_CLASSES}`}>{t('playoffOdds.staleNote', { date: formatOddsDate(latest.run_date) })}</div>
      ) : early && (
        <div className={`playoff-odds-early ${NOTE_CLASSES}`}>{t('playoffOdds.earlyNote')}</div>
      )}
      {!formatKnown && (
        <div className="playoff-odds-unverified text-[11px] text-[color:var(--text-dim)] mb-2">{t('playoffOdds.formatUnverified', names)}</div>
      )}

      {formatKnown ? (
        <div className="grid grid-cols-3 gap-3 items-end">
          <div className="playoff-odds-main">
            <div className={LABEL_CLASSES}>{t('playoffOdds.makePlayoffs')}</div>
            <div className={BIG_CLASSES}>{formatOddsPct(latest.make_playoffs_pct)}</div>
          </div>
          {showDivision ? (
            <div className="playoff-odds-division">
              <div className={LABEL_CLASSES}>{t('playoffOdds.winDivision')}</div>
              <div className={MID_CLASSES}>{formatOddsPct(latest.win_division_pct)}</div>
            </div>
          ) : <div />}
          {points}
        </div>
      ) : points}

      <div className="playoff-odds-now text-[11px] text-[color:var(--text-muted)] mt-2">
        {t('playoffOdds.nowLine', { points: latest.current_points, left: latest.games_remaining })}
      </div>

      {trend.length > 0 && (
        <div className="playoff-odds-trend mt-3">
          <Sparkline
            points={trend}
            width={360} height={56} padding={{ left: 2, right: 2, top: 4, bottom: 4 }}
            yDomain={formatKnown ? { min: 0, max: 100, pad: 0 } : 'auto'}
            referenceValue={formatKnown ? 50 : null}
            haloColor="var(--bg2)"
            ariaLabel={t(formatKnown ? 'playoffOdds.trendLabel' : 'playoffOdds.pointsTrendLabel')}
            className="w-full max-w-[360px]"
          />
        </div>
      )}

      <div className="text-[10px] text-[color:var(--text-dim)] mt-2 italic">
        {t('playoffOdds.source', { sims: (latest.sims || 0).toLocaleString(), date: formatOddsDate(latest.run_date) })}
      </div>
    </div>
  );
}
