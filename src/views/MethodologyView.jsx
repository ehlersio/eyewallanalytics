// src/views/MethodologyView.jsx
// How it works (/methodology): how each published model makes its
// predictions and how the public prediction scorecard grades them, the
// method behind the two data features that aren't predictions (injury
// impact, trade trees), the data sources, and a dated changelog so a
// prediction can always be matched to the model version that made it.
// Linked from the scorecard (League -> Scorecard); each section has an
// anchor (/methodology#game-winners) for links from elsewhere.
//
// Settings quoted in the text were checked against eyewall-pipeline's code
// on METHOD_CHECKED (elo.py, win_probs.py, playoff_odds.py,
// starting_goalie.py / goalie_model.py, prediction_scorecard.py,
// injury_impact.py, trade_parse.py / trade_trees.py). The backtest numbers
// are not typed in -- they come live from the Worker's /scorecard, the
// same data the scorecard shows. When a model changes, update its section
// and add a CHANGELOG entry.
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { getScorecard } from '../utils/nhlApi';
import { formatDate } from '../utils/formatters';
import { useFeatureViewed } from '../utils/analytics';
import { PAGE_CLASSES } from '../utils/pageClasses';

const K = 'methodology';
const METHOD_CHECKED = '2026-09-14';

// Page order. `model` pulls that model's backtest row from /scorecard.
const SECTIONS = [
  { id: 'principles', key: 'principles' },
  { id: 'game-winners', key: 'gameWinners', model: 'game_winner' },
  { id: 'starting-goalies', key: 'startingGoalies', model: 'starting_goalie' },
  { id: 'playoff-odds', key: 'playoffOdds', model: 'playoff_odds' },
  { id: 'grading', key: 'grading' },
  { id: 'injury-impact', key: 'injuryImpact' },
  { id: 'trade-trees', key: 'tradeTrees' },
  { id: 'data', key: 'data' },
  { id: 'changelog', key: 'changelog' },
];

// Dated method changes, newest first (dates from eyewall-pipeline's merge
// history). Add one whenever a model's method or settings change.
const CHANGELOG = [
  // Not a model change: a tested adjustment that wasn't adopted
  // (eyewall-pipeline docs/lineup_adjustment_backtest_results.md).
  { date: '2026-09-14', key: 'lineupTest' },
  { date: '2026-09-14', key: 'tradeTrees' },
  { date: '2026-09-13', key: 'scorecard' },
  { date: '2026-09-13', key: 'startingGoalies' },
  { date: '2026-09-13', key: 'playoffOdds' },
  { date: '2026-09-13', key: 'injuryImpact' },
  { date: '2026-09-10', key: 'elo' },
];

const pct1 = x => (x == null ? '—' : `${(x * 100).toFixed(1)}%`);
const brier = x => (x == null ? '—' : x.toFixed(3));

const P_CLASSES = 'text-[13px] leading-[1.55] text-[color:var(--text-muted)] m-0 mt-2';
const LIST_CLASSES = 'list-disc pl-5 m-0 mt-2 flex flex-col gap-1 text-[13px] leading-[1.5] text-[color:var(--text-muted)]';
const SUBLABEL_CLASSES = 'text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-dim)] mt-3';
const NAV_LINK_CLASSES = 'method-toc-link text-[12px] text-[color:var(--text)] underline underline-offset-2 bg-transparent border-0 p-0 cursor-pointer';

function methodDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d) ? iso : formatDate(d, { month: 'short', day: 'numeric', year: 'numeric' });
}

// A list of strings from the locale file (`returnObjects`); [] if missing.
function useList(key) {
  const { t } = useTranslation();
  const v = t(key, { returnObjects: true, defaultValue: [] });
  return Array.isArray(v) ? v : [];
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// This model's backtest from /scorecard, in one line, against its baseline.
function BacktestLine({ row }) {
  const { t } = useTranslation();
  if (!row?.n) return <p className={`method-backtest ${P_CLASSES} italic`}>{t(`${K}.backtestPending`)}</p>;
  const b = row.baseline;
  return (
    <p className={`method-backtest ${P_CLASSES} text-[color:var(--text)]`}>
      {t(`${K}.backtestLine`, { period: row.period, accuracy: pct1(row.accuracy), brier: brier(row.brier), n: row.n.toLocaleString() })}
      {b && ` ${t(`${K}.baselineLine`, {
        name: t(`scorecard.baselines.${b.name}`, { defaultValue: b.name }),
        accuracy: pct1(b.accuracy),
        brier: brier(b.brier),
      })}`}
    </p>
  );
}

function Section({ id, sectionKey, backtest, children }) {
  const { t } = useTranslation();
  const body = useList(`${K}.sections.${sectionKey}.body`);
  const items = useList(`${K}.sections.${sectionKey}.items`);
  const limits = useList(`${K}.sections.${sectionKey}.limits`);
  const viewRef = useFeatureViewed('methodology', { section: id });
  return (
    <section id={id} ref={viewRef} className="card method-section scroll-mt-3" style={{ marginTop: 10 }}>
      <h2 className="sec-label m-0">{t(`${K}.sections.${sectionKey}.title`)}</h2>
      {body.map((p, i) => <p key={i} className={P_CLASSES}>{p}</p>)}
      {items.length > 0 && <ul className={LIST_CLASSES}>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>}
      {backtest !== undefined && <BacktestLine row={backtest} />}
      {limits.length > 0 && (
        <>
          <div className={SUBLABEL_CLASSES}>{t(`${K}.limitsTitle`)}</div>
          <ul className={`method-limits ${LIST_CLASSES}`}>{limits.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </>
      )}
      {children}
    </section>
  );
}

export default function MethodologyView() {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const { data } = useFetch(getScorecard, []);
  const models = data?.models || {};

  // Deep links (/methodology#playoff-odds) land on their section.
  useEffect(() => {
    if (hash) setTimeout(() => scrollToSection(hash.slice(1)), 0);
  }, [hash]);

  return (
    <div className={`methodology-view ${PAGE_CLASSES}`}>
      <div className="card">
        <Link to="/league?tab=scorecard" className="method-back text-[12px] text-[color:var(--text-muted)] underline underline-offset-2">
          ← {t(`${K}.backToScorecard`)}
        </Link>
        <h1 className="text-[20px] font-bold text-[color:var(--text)] m-0 mt-2">{t(`${K}.title`)}</h1>
        <p className={P_CLASSES}>{t(`${K}.intro`)}</p>
        <nav className="flex flex-wrap gap-x-3 gap-y-1 mt-3" aria-label={t(`${K}.contents`)}>
          {SECTIONS.map(s => (
            <button key={s.id} type="button" className={NAV_LINK_CLASSES} onClick={() => scrollToSection(s.id)}>
              {t(`${K}.sections.${s.key}.title`)}
            </button>
          ))}
        </nav>
        <p className="text-[10px] italic text-[color:var(--text-dim)] m-0 mt-3">
          {t(`${K}.checkedNote`, { date: methodDate(METHOD_CHECKED) })}
        </p>
      </div>

      {SECTIONS.map(s => (
        <Section
          key={s.id}
          id={s.id}
          sectionKey={s.key}
          backtest={s.model ? (models[s.model]?.backtest ?? null) : undefined}
        >
          {s.id === 'changelog' && (
            <ul className={`method-changelog ${LIST_CLASSES} list-none pl-0`}>
              {CHANGELOG.map(c => (
                <li key={`${c.date}-${c.key}`} className="flex gap-3">
                  <span className="shrink-0 w-[92px] font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--text-dim)] pt-[2px]">{methodDate(c.date)}</span>
                  <span>{t(`${K}.changelogEntries.${c.key}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ))}
    </div>
  );
}
