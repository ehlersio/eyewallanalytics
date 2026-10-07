// components/LocalPredictionScorecard.jsx
// The PWHL/AHL/ECHL League page's Scorecard tab: how the app's game
// predictions did, from this device's prediction store
// (utils/hockeyTechPredictionStore.js -- each prediction is saved when a
// game preview opens, and graded by the schedule once the game is final).
// These leagues have no public, server-side scorecard like the NHL's
// (PredictionScorecard.jsx), so this is the record the app keeps locally.
// Nothing graded yet: the NHL scorecard's empty state. Plain probabilities
// and outcomes -- no betting framing.
import { useTranslation } from 'react-i18next';
import { formatDate } from '../utils/formatters';

const RECENT_SHOWN = 5;
const LABEL_CLASSES = 'text-[9px] uppercase tracking-[0.06em] text-[color:var(--text-dim)]';

export default function LocalPredictionScorecard({ store }) {
  const { t } = useTranslation();
  const stats = store.getStats();
  const graded = store.load()
    .filter(p => p.teamActual != null)
    .sort((a, b) => String(b.gameDate || '').localeCompare(String(a.gameDate || '')))
    .slice(0, RECENT_SHOWN);

  return (
    <div className="prediction-scorecard" data-testid="local-scorecard">
      <div className="card">
        <div className="sec-label" style={{ marginBottom: 4 }}>{t('scorecard.localTitle')}</div>
        <div className="text-[12px] text-[color:var(--text-muted)] leading-[1.45]">{t('scorecard.localIntro')}</div>
      </div>
      {!stats.total ? (
        <div className="card scorecard-empty text-[12px] text-[color:var(--text-dim)]" style={{ marginTop: 10 }}>{t('scorecard.empty')}</div>
      ) : (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <div className={LABEL_CLASSES}>{t('scorecard.accuracy')}</div>
              <div className="scorecard-accuracy font-[family-name:var(--font-mono)] text-[20px] font-bold leading-none text-[color:var(--text)]">{stats.pct}%</div>
            </div>
            <div>
              {stats.avgError != null && (
                <>
                  <div className={LABEL_CLASSES}>{t('scorecard.localScoreErrorLabel')}</div>
                  <div className="scorecard-score-error font-[family-name:var(--font-mono)] text-[16px] font-bold leading-none text-[color:var(--text)]">{stats.avgError}</div>
                </>
              )}
            </div>
            <div className="text-[11px] text-[color:var(--text-dim)]">{t('scorecard.graded', { count: stats.total, n: stats.total.toLocaleString() })}</div>
          </div>
          {stats.avgError != null && (
            <div className="text-[11px] text-[color:var(--text-muted)] mt-1.5">{t('scorecard.localScoreErrorHelp')}</div>
          )}
          <div className="mt-3">
            <div className={LABEL_CLASSES}>{t('scorecard.recentTitle')}</div>
            {graded.map(p => (
              <div key={p.gameId} className="scorecard-recent-item flex items-center justify-between gap-2 text-[11px] py-[2px]">
                <span className="text-[color:var(--text-muted)] truncate">
                  {t('scorecard.localRecentItem', {
                    date: p.gameDate ? formatDate(p.gameDate) : '—',
                    opp: p.opponent || '—',
                    outcome: p.predictedTeamWin ? t('scorecard.localOutcomeWin') : t('scorecard.localOutcomeLoss'),
                    score: `${p.teamActual}–${p.oppActual}`,
                  })}
                </span>
                <span className={p.correct ? 'text-[color:var(--green)]' : 'text-[color:var(--red-bright)]'} aria-label={p.correct ? t('scorecard.hit') : t('scorecard.miss')}>
                  {p.correct ? '✓' : '✗'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
