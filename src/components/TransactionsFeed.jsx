// src/components/TransactionsFeed.jsx
// League signings/moves feed, rendered as a tab on the News view.
//
// sport="pwhl" (default, PWHLNewsView.jsx): HockeyTech's league-wide feed,
// unchanged from the original PWHL-only version -- no player_id on rows
// (just a display name), so no tap-to-open-popup affordance, and no team
// filter (HockeyTech's default 50-row page is short enough as-is).
//
// sport="nhl" (NewsView.jsx, 2026-09): the Worker's /transactions route
// (ESPN's NHL feed via eyewall-pipeline's transactions.py). Rows are ESPN's
// free-text descriptions with a category badge; the Worker has already
// merged each trade's two per-team halves into one trade item, rendered as
// one card with both sides. Toggles between the selected team and the
// whole league.
//
// Both share FeedShell (header + loading/error/empty states), which keeps
// the PWHL markup exactly as it was.
//
// NHL trades (paired, or a single trade entry whose other half ESPN never
// posted) have a "Trade tree" toggle that opens TradeTree.jsx inline: what
// each side got and where every asset went next.
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPWHLTransactions } from '../utils/pwhlApi';
import { getTransactions, TEAM_CONFIG } from '../utils/nhlApi';
import { formatDate } from '../utils/formatters';
import { capture, trackFeature } from '../utils/analytics';
import TeamLogo from './TeamLogo';
import TradeTree from './TradeTree';
import {
  NEWS_HEADER_CLASSES, NEWS_HEADER_ROW_CLASSES, NEWS_TITLE_CLASSES, NEWS_UPDATED_CLASSES,
  NEWS_FEED_CLASSES, NEWS_CARD_CLASSES, NEWS_CARD_BODY_CLASSES, NEWS_CARD_META_CLASSES,
  NEWS_CARD_TIME_CLASSES, NEWS_LOADING_CLASSES, NEWS_SKELETON_CLASSES, SKEL_BADGE_CLASSES,
  SKEL_TITLE_CLASSES, SKEL_TEXT_CLASSES, NEWS_ERROR_CLASSES, NEWS_EMPTY_CLASSES,
  NEWS_ERROR_ICON_CLASSES, NEWS_ERROR_MSG_CLASSES, NEWS_REFRESH_BTN_CLASSES,
  MILESTONES_FEED_CLASSES, MILESTONE_ICON_BADGE_CLASSES, MILESTONE_CARD_TITLE_CLASSES,
  MILESTONE_DETAIL_ROW_CLASSES, MILESTONE_DETAIL_ITEM_CLASSES,
} from '../utils/newsViewClasses';

function formatTxDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d)) return dateStr;
  return formatDate(d, { month: 'short', day: 'numeric' });
}

// Self-fetching list state shared by both sports. `load` returns the list
// (or throws); the latest-request ref drops a stale response if the user
// flips scope while a fetch is still in flight.
function useFeed(load) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const list = await load();
      if (request === requestRef.current) setItems(list);
    } catch (err) {
      if (request === requestRef.current) setError(err.message);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [load]);

  useEffect(() => { refresh(); }, [refresh]);
  return { items, loading, error, refresh };
}

function FeedShell({ loading, error, count, onRefresh, controls, footer, children }) {
  const { t } = useTranslation();
  return (
    <div className={MILESTONES_FEED_CLASSES}>
      <div className={`${NEWS_HEADER_CLASSES} card`}>
        <div className={NEWS_HEADER_ROW_CLASSES}>
          <div>
            <div className={NEWS_TITLE_CLASSES}>{t('transactionsFeed.header.title')}</div>
            {!loading && (
              <div className={NEWS_UPDATED_CLASSES}>{t('transactionsFeed.header.recentCount', { count })}</div>
            )}
          </div>
          <button className={NEWS_REFRESH_BTN_CLASSES} onClick={onRefresh} disabled={loading}
            aria-label={t('newsView.header.refreshAriaLabel')}>
            {loading ? '…' : '↻'}
          </button>
        </div>
        {controls}
      </div>

      {loading && (
        <div className={NEWS_LOADING_CLASSES}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`${NEWS_SKELETON_CLASSES} card`}>
              <div className={SKEL_BADGE_CLASSES} />
              <div className={SKEL_TITLE_CLASSES} />
              <div className={SKEL_TEXT_CLASSES} />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className={`${NEWS_ERROR_CLASSES} card`}>
          <div className={NEWS_ERROR_ICON_CLASSES}>🤝</div>
          <div className={NEWS_ERROR_MSG_CLASSES}>{error}</div>
          <button className={NEWS_REFRESH_BTN_CLASSES} onClick={onRefresh}>{t('triviaFeed.error.tryAgain')}</button>
        </div>
      )}

      {!loading && !error && count === 0 && (
        <div className={`${NEWS_EMPTY_CLASSES} card`}>
          <div className={NEWS_ERROR_ICON_CLASSES}>🤝</div>
          <div>{t('transactionsFeed.emptyState')}</div>
        </div>
      )}

      {!loading && !error && count > 0 && (
        <div className={NEWS_FEED_CLASSES}>{children}</div>
      )}
      {!loading && !error && count > 0 && footer}
    </div>
  );
}

// ── PWHL ───────────────────────────────────────────────────────

// HockeyTech has only ever returned "ADD"/"Signed" in every real pull seen
// so far -- other type/action values are unconfirmed, so this maps known
// ones and falls back to the raw action text rather than guessing a label.
function txIcon(type) {
  if (type === 'ADD') return '✍️';
  return '🔁';
}

function TransactionRow({ tx }) {
  const { t } = useTranslation();
  return (
    <article className={`${NEWS_CARD_CLASSES} card`}>
      <div className={NEWS_CARD_BODY_CLASSES}>
        <div className={NEWS_CARD_META_CLASSES}>
          <span className={MILESTONE_ICON_BADGE_CLASSES}>{txIcon(tx.type)} {tx.action || t('transactionsFeed.defaultAction')}</span>
          <span className={NEWS_CARD_TIME_CLASSES}>{formatTxDate(tx.date)}</span>
        </div>
        <h3 className={MILESTONE_CARD_TITLE_CLASSES}>{tx.player}</h3>
        <div className={MILESTONE_DETAIL_ROW_CLASSES}>
          {tx.team && <span className={MILESTONE_DETAIL_ITEM_CLASSES}>{tx.team}</span>}
          {tx.from && <span className={MILESTONE_DETAIL_ITEM_CLASSES}>{t('transactionsFeed.from', { team: tx.from })}</span>}
        </div>
      </div>
    </article>
  );
}

function PWHLTransactionsFeed() {
  const { t } = useTranslation();
  const load = useCallback(async () => {
    const data = await fetchPWHLTransactions();
    if (!data) throw new Error(t('transactionsFeed.error.notAvailable'));
    return Array.isArray(data.transactions) ? data.transactions : [];
  }, [t]);
  const { items, loading, error, refresh } = useFeed(load);

  return (
    <FeedShell loading={loading} error={error} count={items.length} onRefresh={refresh}>
      {items.map((tx, i) => <TransactionRow key={i} tx={tx} />)}
    </FeedShell>
  );
}

// ── NHL ────────────────────────────────────────────────────────

// One badge per category -- matches eyewall-pipeline transactions.py's
// CATEGORIES / primary_category values, plus 'other'.
const NHL_CATEGORY_ICONS = {
  trade: '🔁', signing: '✍️', waivers: '📋', injury: '🩹', recall: '⬆️',
  assignment: '⬇️', release: '✂️', suspension: '⛔', staff: '🧑‍💼', other: '•',
};

const TX_DESC_CLASSES = 'tx-desc text-[13px] leading-[1.45] text-[color:var(--text-muted)] m-0';
const TX_TEAM_ROW_CLASSES = 'flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--text)]';

function scopeBtnClasses(active) {
  const base = 'tx-scope-btn text-[11px] font-semibold py-[3px] px-2.5 rounded-full border-[0.5px] cursor-pointer';
  return active
    ? `${base} bg-[var(--team-primary)] text-white border-transparent`
    : `${base} bg-transparent text-[color:var(--text-muted)] border-[var(--border-2)]`;
}

function CategoryBadge({ category }) {
  const { t } = useTranslation();
  const key = NHL_CATEGORY_ICONS[category] ? category : 'other';
  return (
    <span className={MILESTONE_ICON_BADGE_CLASSES}>
      {NHL_CATEGORY_ICONS[key]} {t(`transactionsFeed.nhl.category.${key}`)}
    </span>
  );
}

const TREE_BTN_CLASSES = 'tx-tree-btn self-start text-[12px] font-semibold text-[color:var(--text)] underline underline-offset-2 bg-transparent border-0 p-0 mt-1 cursor-pointer';

// `txId`: any nhl_transactions row id in the trade (the Worker's
// /trades/tree?tx=). Hidden when the item has none (a feed cached before the
// Worker started sending ids).
function TradeTreeToggle({ txId }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (txId == null) return null;
  const toggle = () => {
    if (!open) trackFeature('trade_tree', 'open');
    setOpen(!open);
  };
  return (
    <>
      <button type="button" className={TREE_BTN_CLASSES} aria-expanded={open} onClick={toggle}>
        {open ? t('transactionsFeed.nhl.tree.close') : `${t('transactionsFeed.nhl.tree.open')} ▸`}
      </button>
      {open && <TradeTree txId={txId} />}
    </>
  );
}

function NHLMoveRow({ item }) {
  return (
    <article className={`tx-item tx-move ${NEWS_CARD_CLASSES} card`}>
      <div className={NEWS_CARD_BODY_CLASSES}>
        <div className={NEWS_CARD_META_CLASSES}>
          <CategoryBadge category={item.category} />
          <span className={NEWS_CARD_TIME_CLASSES}>{formatTxDate(item.date)}</span>
        </div>
        <div className={TX_TEAM_ROW_CLASSES}>
          <TeamLogo abbr={item.team} size={16} /> {item.team}
        </div>
        <p className={TX_DESC_CLASSES}>{item.description}</p>
        {item.categories?.includes('trade') && <TradeTreeToggle txId={item.id} />}
      </div>
    </article>
  );
}

function NHLTradeRow({ item }) {
  const { t } = useTranslation();
  const [a, b] = item.teams;
  return (
    <article className={`tx-item tx-trade ${NEWS_CARD_CLASSES} card`}>
      <div className={NEWS_CARD_BODY_CLASSES}>
        <div className={NEWS_CARD_META_CLASSES}>
          <CategoryBadge category="trade" />
          <span className={NEWS_CARD_TIME_CLASSES}>{formatTxDate(item.date)}</span>
        </div>
        <div className={TX_TEAM_ROW_CLASSES} aria-label={t('transactionsFeed.nhl.tradeAriaLabel', { a, b })}>
          <TeamLogo abbr={a} size={16} /> {a}
          <span className="text-[color:var(--text-dim)] font-normal" aria-hidden="true">⇄</span>
          <TeamLogo abbr={b} size={16} /> {b}
        </div>
        {item.sides.map(s => (
          <p key={s.team} className={TX_DESC_CLASSES}>
            <span className="font-semibold text-[color:var(--text)]">{s.team}:</span> {s.description}
          </p>
        ))}
        <TradeTreeToggle txId={item.ids?.[0]} />
      </div>
    </article>
  );
}

function NHLTransactionsFeed() {
  const { t } = useTranslation();
  const teamAbbr = TEAM_CONFIG.abbr;
  const [scope, setScope] = useState('team');

  const load = useCallback(async () => {
    const data = await getTransactions(scope, teamAbbr);
    if (!data) throw new Error(t('transactionsFeed.error.notAvailable'));
    return Array.isArray(data.items) ? data.items : [];
  }, [scope, teamAbbr, t]);
  const { items, loading, error, refresh } = useFeed(load);

  const pickScope = (next) => {
    if (next === scope) return;
    setScope(next);
    capture('transactions_scope_changed', { sport: 'nhl', scope: next });
  };

  const controls = (
    <div className="flex gap-1.5 mt-2" role="group" aria-label={t('transactionsFeed.nhl.scopeAriaLabel')}>
      <button className={scopeBtnClasses(scope === 'team')} aria-pressed={scope === 'team'} onClick={() => pickScope('team')}>
        {t('transactionsFeed.nhl.scopeTeam', { team: teamAbbr })}
      </button>
      <button className={scopeBtnClasses(scope === 'league')} aria-pressed={scope === 'league'} onClick={() => pickScope('league')}>
        {t('transactionsFeed.nhl.scopeLeague')}
      </button>
    </div>
  );
  const footer = (
    <div className="text-[10px] text-[color:var(--text-dim)] italic px-1 pt-1">{t('transactionsFeed.nhl.source')}</div>
  );

  return (
    <FeedShell loading={loading} error={error} count={items.length} onRefresh={refresh} controls={controls} footer={footer}>
      {items.map((item, i) => item.kind === 'trade'
        ? <NHLTradeRow key={`t${i}`} item={item} />
        : <NHLMoveRow key={`m${i}`} item={item} />)}
    </FeedShell>
  );
}

export default function TransactionsFeed({ sport = 'pwhl' }) {
  return sport === 'nhl' ? <NHLTransactionsFeed /> : <PWHLTransactionsFeed />;
}
