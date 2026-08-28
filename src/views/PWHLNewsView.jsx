// views/PWHLNewsView.jsx — mirrors NHL NewsView for PWHL
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import MilestonesFeed from '../components/MilestonesFeed';
import TriviaFeed from '../components/TriviaFeed';
import TransactionsFeed from '../components/TransactionsFeed';
import { capture } from '../utils/analytics';
import { useReadState } from '../hooks/useReadState';
import { formatDate } from '../utils/formatters';
import {
  NEWS_VIEW_CLASSES, NEWS_HEADER_CLASSES, NEWS_HEADER_ROW_CLASSES, NEWS_TITLE_CLASSES,
  NEWS_UPDATED_CLASSES, NEWS_REFRESH_BTN_CLASSES, NEWS_FILTER_CHIPS_CLASSES, newsChipClasses,
  NEWS_FEED_CLASSES, NEWS_CARD_CLASSES, NEWS_CARD_IMG_CLASSES, NEWS_CARD_BODY_CLASSES,
  NEWS_CARD_META_CLASSES, NEWS_SOURCE_BADGE_CLASSES, NEWS_CARD_TIME_CLASSES,
  NEWS_CARD_TITLE_CLASSES, NEWS_CARD_EXCERPT_CLASSES, NEWS_CARD_ARROW_CLASSES,
  NEWS_LOADING_CLASSES, NEWS_SKELETON_CLASSES, SKEL_BADGE_CLASSES, SKEL_TITLE_CLASSES,
  SKEL_TEXT_CLASSES, NEWS_ERROR_CLASSES, NEWS_EMPTY_CLASSES, NEWS_ERROR_ICON_CLASSES,
  NEWS_ERROR_MSG_CLASSES, NEWS_FOOTER_CLASSES, NEWS_PAGINATION_CLASSES, NEWS_PAGE_BTN_CLASSES,
  NEWS_PAGE_INFO_CLASSES, NEWS_VIEW_TOGGLE_CLASSES, newsViewToggleBtnClasses,
  NEWS_VIEW_TOGGLE_DOT_CLASSES,
} from '../utils/newsViewClasses';
import { PAGE_CLASSES } from '../utils/pageClasses';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
const PAGE_SIZE  = 10;

const SOURCE_META = {
  'pwhl-official': { label: 'PWHL',      color: '#FFFFFF', bg: '#001F5B' },
  'espn-womens':   { label: 'ESPN',       color: '#FFFFFF', bg: '#cc0000' },
  'sportsnet-pwhl':{ label: 'Sportsnet',  color: '#000000', bg: '#d4a017' },
  'iihf':          { label: 'IIHF',       color: '#FFFFFF', bg: '#003087' },
};

function timeAgo(isoDate, t) {
  if (!isoDate) return '';
  const diff = (Date.now() - new Date(isoDate)) / 1000;
  if (diff < 60)     return t('newsView.timeAgo.justNow');
  if (diff < 3600)   return t('newsView.timeAgo.minutes', { count: Math.floor(diff / 60) });
  if (diff < 86400)  return t('newsView.timeAgo.hours', { count: Math.floor(diff / 3600) });
  if (diff < 604800) return t('newsView.timeAgo.days', { count: Math.floor(diff / 86400) });
  return formatDate(new Date(isoDate), { month: 'short', day: 'numeric' });
}

function SourceBadge({ sourceId }) {
  const meta = SOURCE_META[sourceId] || { label: sourceId, color: '#fff', bg: '#555' };
  return (
    <span className={NEWS_SOURCE_BADGE_CLASSES} style={{ background: meta.bg, color: meta.color }}>
      {meta.label}
    </span>
  );
}

function ArticleCard({ item }) {
  const { t } = useTranslation();
  function handleClick() {
    if (item.url) {
      capture('news_article_clicked', { source: item.source, title: item.title?.slice(0, 60), sport: 'pwhl' });
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  }
  return (
    <article className={`${NEWS_CARD_CLASSES} card`} onClick={handleClick} role="link" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
      aria-label={item.title}>
      {item.imageUrl && (
        <div className={NEWS_CARD_IMG_CLASSES}>
          <img src={item.imageUrl} alt="" loading="lazy" />
        </div>
      )}
      <div className={NEWS_CARD_BODY_CLASSES}>
        <div className={NEWS_CARD_META_CLASSES}>
          <SourceBadge sourceId={item.source} />
          <span className={NEWS_CARD_TIME_CLASSES}>{timeAgo(item.publishedAt, t)}</span>
        </div>
        <h3 className={NEWS_CARD_TITLE_CLASSES}>{item.title}</h3>
        {item.excerpt && item.excerpt !== item.sourceName && (
          <p className={NEWS_CARD_EXCERPT_CLASSES}>{item.excerpt}</p>
        )}
      </div>
      <div className={NEWS_CARD_ARROW_CLASSES}>→</div>
    </article>
  );
}

export default function PWHLNewsView() {
  const { t } = useTranslation();
  const [view,      setView]      = useState('news'); // 'news' | 'milestones' | 'trivia' | 'transactions'
  const [articles,  setArticles]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [filter,    setFilter]    = useState('all');
  const [page,      setPage]      = useState(1);

  const fetchingRef = useRef(false);
  const retryRef    = useRef(null);
  const readState   = useReadState();

  const fetchArticles = useCallback(async (isRetry = false) => {
    if (!WORKER_URL) { setError(t('triviaFeed.error.workerNotConfigured')); setLoading(false); return; }
    if (fetchingRef.current && !isRetry) return;
    fetchingRef.current = true;
    if (!isRetry) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${WORKER_URL}/pwhl/news`, { cache: 'no-store' });
      if (!res.ok) throw new Error(t('newsView.error.notAvailable'));
      const data = await res.json();
      const arr  = Array.isArray(data) ? data : [];
      const seen = new Set();
      const deduped = arr.filter(a => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });
      if (deduped.length === 0 && !isRetry) {
        retryRef.current = setTimeout(() => {
          fetchingRef.current = false;
          fetchArticles(true);
        }, 4000);
        return;
      }
      setArticles(deduped);
      setFilter('all');
      setPage(1);
      setLastFetch(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      if (isRetry || fetchingRef.current) {
        setLoading(false);
        fetchingRef.current = false;
      }
    }
  }, [t]);

  useEffect(() => {
    if (view !== 'news') return;
    fetchArticles();
    return () => { if (retryRef.current) clearTimeout(retryRef.current); };
  }, [fetchArticles, view]);

  useEffect(() => { setPage(1); }, [filter]);

  const availableSources = useMemo(() => {
    const seen = new Set(articles.map(a => a.source));
    return ['all', ...Array.from(seen)];
  }, [articles]);

  const filtered = useMemo(() =>
    filter === 'all' ? articles : articles.filter(a => a.source === filter),
    [articles, filter]
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = useMemo(() =>
    filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  return (
    <div className={`${NEWS_VIEW_CLASSES} ${PAGE_CLASSES}`}>
      {/* News / Milestones toggle */}
      <div className={NEWS_VIEW_TOGGLE_CLASSES}>
        <button
          className={newsViewToggleBtnClasses(view === 'news')}
          onClick={() => { setView('news'); readState.markSeen('news'); }}
        >
          {t('nav.news')}{readState.news && <span className={NEWS_VIEW_TOGGLE_DOT_CLASSES} />}
        </button>
        <button
          className={newsViewToggleBtnClasses(view === 'milestones')}
          onClick={() => { setView('milestones'); capture('milestones_tab_viewed', { sport: 'pwhl' }); readState.markSeen('milestones'); }}
        >
          {t('milestonesFeed.header.title')}{readState.milestones && <span className={NEWS_VIEW_TOGGLE_DOT_CLASSES} />}
        </button>
        <button
          className={newsViewToggleBtnClasses(view === 'trivia')}
          onClick={() => { setView('trivia'); capture('trivia_tab_viewed', { sport: 'pwhl' }); }}
        >
          {t('newsView.tabs.trivia')}{readState.trivia && <span className={NEWS_VIEW_TOGGLE_DOT_CLASSES} />}
        </button>
        <button
          className={newsViewToggleBtnClasses(view === 'transactions')}
          onClick={() => { setView('transactions'); capture('transactions_tab_viewed', { sport: 'pwhl' }); }}
        >
          {t('newsView.tabs.transactions')}
        </button>
      </div>

      {view === 'milestones' && <MilestonesFeed />}
      {view === 'trivia' && <TriviaFeed />}
      {view === 'transactions' && <TransactionsFeed />}

      {view === 'news' && (
        <>
          <div className={`${NEWS_HEADER_CLASSES} card`}>
            <div className={NEWS_HEADER_ROW_CLASSES}>
              <div>
                <div className={NEWS_TITLE_CLASSES}>{t('newsView.header.pwhlNews')}</div>
                {lastFetch && (
                  <div className={NEWS_UPDATED_CLASSES}>
                    {t('newsView.header.updated', { time: timeAgo(lastFetch.toISOString(), t), count: articles.length })}
                  </div>
                )}
              </div>
              <button className={NEWS_REFRESH_BTN_CLASSES} onClick={fetchArticles} disabled={loading}
                aria-label={t('newsView.header.refreshAriaLabel')}>
                {loading ? '…' : '↻'}
              </button>
            </div>
            <div className={NEWS_FILTER_CHIPS_CLASSES}>
              {availableSources.map(s => (
                <button key={s}
                  className={newsChipClasses(filter === s)}
                  onClick={() => { setFilter(s); if (s !== 'all') capture('news_filter_changed', { source: s, sport: 'pwhl' }); }}>
                  {s === 'all'
                    ? t('newsView.header.allSources', { count: articles.length })
                    : (SOURCE_META[s]?.label || s)}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className={NEWS_LOADING_CLASSES}>
              {[1,2,3,4].map(i => (
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
              <div className={NEWS_ERROR_ICON_CLASSES}>📰</div>
              <div className={NEWS_ERROR_MSG_CLASSES}>{error}</div>
              <button className={NEWS_REFRESH_BTN_CLASSES} onClick={fetchArticles}>{t('triviaFeed.error.tryAgain')}</button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className={`${NEWS_EMPTY_CLASSES} card`}>
              <div className={NEWS_ERROR_ICON_CLASSES}>📰</div>
              <div>{filter !== 'all' ? t('newsView.emptyStateFromSource', { source: SOURCE_META[filter]?.label || filter }) : t('newsView.emptyState')}</div>
            </div>
          )}

          {!loading && !error && paginated.length > 0 && (
            <>
              <div className={NEWS_FEED_CLASSES}>
                {paginated.map((item, i) => <ArticleCard key={`${item.id}-${i}`} item={item} />)}
              </div>
              {totalPages > 1 && (
                <div className={NEWS_PAGINATION_CLASSES}>
                  <button className={NEWS_PAGE_BTN_CLASSES}
                    onClick={() => { setPage(p => p-1); window.scrollTo({ top:0, behavior:'smooth' }); }}
                    disabled={page === 1}>{t('newsView.pagination.prev')}</button>
                  <span className={NEWS_PAGE_INFO_CLASSES}>{page} / {totalPages}</span>
                  <button className={NEWS_PAGE_BTN_CLASSES}
                    onClick={() => { setPage(p => p+1); window.scrollTo({ top:0, behavior:'smooth' }); }}
                    disabled={page === totalPages}>{t('newsView.pagination.next')}</button>
                </div>
              )}
            </>
          )}

          <div className={NEWS_FOOTER_CLASSES}>
            {t('newsView.footer.pwhl')}
          </div>
        </>
      )}
    </div>
  );
}
