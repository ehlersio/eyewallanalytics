// src/components/TransactionsFeed.jsx
// PWHL-only league-wide signings/moves feed (Session: "remaining flagged
// items" round). Rendered as a tab inside PWHLNewsView.jsx alongside
// News/Milestones/Trivia, mirroring MilestonesFeed.jsx's self-fetching +
// card-reuse pattern -- but simpler: no player_id on transaction rows (just
// a display name), so no tap-to-open-popup affordance, and no team filter
// (the feed is short enough as-is, HockeyTech's default 50-row page).
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPWHLTransactions } from '../utils/pwhlApi';
import { formatDate } from '../utils/formatters';
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

export default function TransactionsFeed() {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const fetchingRef = useRef(false);

  const fetchTransactions = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPWHLTransactions();
      if (!data) throw new Error(t('transactionsFeed.error.notAvailable'));
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [t]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  return (
    <div className={MILESTONES_FEED_CLASSES}>
      <div className={`${NEWS_HEADER_CLASSES} card`}>
        <div className={NEWS_HEADER_ROW_CLASSES}>
          <div>
            <div className={NEWS_TITLE_CLASSES}>{t('transactionsFeed.header.title')}</div>
            {!loading && (
              <div className={NEWS_UPDATED_CLASSES}>{t('transactionsFeed.header.recentCount', { count: transactions.length })}</div>
            )}
          </div>
          <button className={NEWS_REFRESH_BTN_CLASSES} onClick={fetchTransactions} disabled={loading}
            aria-label={t('newsView.header.refreshAriaLabel')}>
            {loading ? '…' : '↻'}
          </button>
        </div>
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
          <button className={NEWS_REFRESH_BTN_CLASSES} onClick={fetchTransactions}>{t('triviaFeed.error.tryAgain')}</button>
        </div>
      )}

      {!loading && !error && transactions.length === 0 && (
        <div className={`${NEWS_EMPTY_CLASSES} card`}>
          <div className={NEWS_ERROR_ICON_CLASSES}>🤝</div>
          <div>{t('transactionsFeed.emptyState')}</div>
        </div>
      )}

      {!loading && !error && transactions.length > 0 && (
        <div className={NEWS_FEED_CLASSES}>
          {transactions.map((tx, i) => <TransactionRow key={i} tx={tx} />)}
        </div>
      )}
    </div>
  );
}
