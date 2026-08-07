import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { capture } from '../utils/analytics';
import { TEAM_CONFIG } from '../utils/nhlApi';
import MilestonesFeed from '../components/MilestonesFeed';
import TriviaFeed from '../components/TriviaFeed';
import { useReadState } from '../hooks/useReadState';
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

const WORKER_URL  = import.meta.env.VITE_WORKER_URL || '';
const PAGE_SIZE   = 10;

const SOURCE_META = {
  canescountry: { label: 'Canes Country', color: '#ffffff', bg: '#cc2200' },
  espn:         { label: 'ESPN',          color: '#ffffff', bg: '#cc0000' },
  sportsnet:    { label: 'Sportsnet',     color: '#000000', bg: '#d4a017' },
  thescore:     { label: 'The Score',     color: '#ffffff', bg: '#e8000d' },
};

function timeAgo(isoDate) {
  if (!isoDate) return '';
  const diff = (Date.now() - new Date(isoDate)) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function SourceBadge({ sourceId, label, color, bg }) {
  const meta = SOURCE_META[sourceId] || { label: label || sourceId, color: color || '#fff', bg: bg || '#555' };
  return (
    <span className={NEWS_SOURCE_BADGE_CLASSES} style={{ background: meta.bg, color: meta.color }}>
      {meta.label}
    </span>
  );
}

function ArticleCard({ item }) {
  const handleClick = () => {
    if (item.url) {
      capture('news_article_clicked', { source: item.source, title: item.title?.slice(0, 60) });
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  };
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
          <SourceBadge sourceId={item.source} label={item.sourceName} />
          <span className={NEWS_CARD_TIME_CLASSES}>{timeAgo(item.publishedAt)}</span>
        </div>
        <h3 className={NEWS_CARD_TITLE_CLASSES}>{item.title}</h3>
        {item.excerpt && item.excerpt !== item.sourceName && (
          <p className={NEWS_CARD_EXCERPT_CLASSES}>
            {item.source === 'reddit' && item.score != null
              ? `▲ ${item.score.toLocaleString()} · 💬 ${item.comments} · ${item.excerpt}`
              : item.excerpt}
          </p>
        )}
      </div>
      <div className={NEWS_CARD_ARROW_CLASSES}>→</div>
    </article>
  );
}

export default function NewsView() {
  const [view,      setView]      = useState('news'); // 'news' | 'milestones' | 'trivia'
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
    if (!WORKER_URL) { setError('Worker URL not configured'); setLoading(false); return; }
    if (fetchingRef.current && !isRetry) return;
    fetchingRef.current = true;
    if (!isRetry) setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${WORKER_URL}/news?team=${TEAM_CONFIG.abbr}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('News not yet available — check back soon');
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      // Deduplicate by id — Worker may return duplicates if multiple sources
      // return the same article URL
      const seen = new Set();
      const deduped = arr.filter(a => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });
      if (deduped.length === 0 && !isRetry) {
        // Cold cache — worker is populating in background. Retry in 4s.
        retryRef.current = setTimeout(() => {
          fetchingRef.current = false;
          fetchArticles(true);
        }, 4000);
        // Leave loading spinner up during retry wait
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
  }, [TEAM_CONFIG.abbr]);  

  useEffect(() => {
    if (view !== 'news') return;
    fetchArticles();
    return () => { if (retryRef.current) clearTimeout(retryRef.current); };
  }, [fetchArticles, view]);

  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [filter]);

  // Build filter chips from actual article data
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
    <div className={`${NEWS_VIEW_CLASSES} page`}>
      {/* News / Milestones toggle */}
      <div className={NEWS_VIEW_TOGGLE_CLASSES}>
        <button
          className={newsViewToggleBtnClasses(view === 'news')}
          onClick={() => { setView('news'); readState.markSeen('news'); }}
        >
          News{readState.news && <span className={NEWS_VIEW_TOGGLE_DOT_CLASSES} />}
        </button>
        <button
          className={newsViewToggleBtnClasses(view === 'milestones')}
          onClick={() => { setView('milestones'); capture('milestones_tab_viewed'); readState.markSeen('milestones'); }}
        >
          Milestones{readState.milestones && <span className={NEWS_VIEW_TOGGLE_DOT_CLASSES} />}
        </button>
        <button
          className={newsViewToggleBtnClasses(view === 'trivia')}
          onClick={() => { setView('trivia'); capture('trivia_tab_viewed'); }}
        >
          Trivia{readState.trivia && <span className={NEWS_VIEW_TOGGLE_DOT_CLASSES} />}
        </button>
      </div>

      {view === 'milestones' && <MilestonesFeed />}
      {view === 'trivia' && <TriviaFeed />}

      {view === 'news' && (
        <>
          {/* Header */}
          <div className={`${NEWS_HEADER_CLASSES} card`}>
            <div className={NEWS_HEADER_ROW_CLASSES}>
              <div>
                <div className={NEWS_TITLE_CLASSES}>{TEAM_CONFIG.displayName} News</div>
                {lastFetch && (
                  <div className={NEWS_UPDATED_CLASSES}>Updated {timeAgo(lastFetch.toISOString())} · {articles.length} articles</div>
                )}
              </div>
              <button className={NEWS_REFRESH_BTN_CLASSES} onClick={fetchArticles} disabled={loading}
                aria-label="Refresh news">
                {loading ? '…' : '↻'}
              </button>
            </div>

            {/* Source filter chips — built from actual data */}
            <div className={NEWS_FILTER_CHIPS_CLASSES}>
              {availableSources.map(s => (
                <button
                  key={s}
                  className={newsChipClasses(filter === s)}
                  onClick={() => { setFilter(s); if (s !== 'all') capture('news_filter_changed', { source: s }); }}
                >
                  {s === 'all' ? `All (${articles.length})` : (SOURCE_META[s]?.label || s)}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
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
              <button className={NEWS_REFRESH_BTN_CLASSES} onClick={fetchArticles}>Try again</button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className={`${NEWS_EMPTY_CLASSES} card`}>
              <div className={NEWS_ERROR_ICON_CLASSES}>📰</div>
              <div>No articles found{filter !== 'all' ? ` from ${SOURCE_META[filter]?.label || filter}` : ''}.</div>
            </div>
          )}

          {!loading && !error && paginated.length > 0 && (
            <>
              <div className={NEWS_FEED_CLASSES}>
                {paginated.map((item, i) => <ArticleCard key={`${item.id}-${i}`} item={item} />)}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className={NEWS_PAGINATION_CLASSES}>
                  <button
                    className={NEWS_PAGE_BTN_CLASSES}
                    onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={page === 1}
                  >← Prev</button>
                  <span className={NEWS_PAGE_INFO_CLASSES}>{page} / {totalPages}</span>
                  <button
                    className={NEWS_PAGE_BTN_CLASSES}
                    onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={page === totalPages}
                  >Next →</button>
                </div>
              )}
            </>
          )}

          <div className={NEWS_FOOTER_CLASSES}>
            Articles from team blogs, ESPN, Sportsnet, Bleacher Report, The Athletic, and Reddit.
            Tap any article to read the full story.
          </div>
        </>
      )}
    </div>
  );
}
