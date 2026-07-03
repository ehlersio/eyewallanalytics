import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import './NewsView.css';
import { capture } from '../utils/analytics';
import { TEAM_CONFIG } from '../utils/nhlApi';
import MilestonesFeed from '../components/MilestonesFeed';

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
    <span className="news-source-badge" style={{ background: meta.bg, color: meta.color }}>
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
    <article className="news-card card" onClick={handleClick} role="link" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
      aria-label={item.title}>
      {item.imageUrl && (
        <div className="news-card-img">
          <img src={item.imageUrl} alt="" loading="lazy" />
        </div>
      )}
      <div className="news-card-body">
        <div className="news-card-meta">
          <SourceBadge sourceId={item.source} label={item.sourceName} />
          <span className="news-card-time">{timeAgo(item.publishedAt)}</span>
        </div>
        <h3 className="news-card-title">{item.title}</h3>
        {item.excerpt && item.excerpt !== item.sourceName && (
          <p className="news-card-excerpt">
            {item.source === 'reddit' && item.score != null
              ? `▲ ${item.score.toLocaleString()} · 💬 ${item.comments} · ${item.excerpt}`
              : item.excerpt}
          </p>
        )}
      </div>
      <div className="news-card-arrow">→</div>
    </article>
  );
}

export default function NewsView() {
  const [view,      setView]      = useState('news'); // 'news' | 'milestones'
  const [articles,  setArticles]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [filter,    setFilter]    = useState('all');
  const [page,      setPage]      = useState(1);

  const fetchingRef = useRef(false);
  const retryRef    = useRef(null);

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
    <div className="news-view page">
      {/* News / Milestones toggle */}
      <div className="news-view-toggle">
        <button
          className={`news-view-toggle-btn${view === 'news' ? ' active' : ''}`}
          onClick={() => setView('news')}
        >
          News
        </button>
        <button
          className={`news-view-toggle-btn${view === 'milestones' ? ' active' : ''}`}
          onClick={() => { setView('milestones'); capture('milestones_tab_viewed'); }}
        >
          Milestones
        </button>
      </div>

      {view === 'milestones' && <MilestonesFeed />}

      {view === 'news' && (
        <>
          {/* Header */}
          <div className="news-header card">
            <div className="news-header-row">
              <div>
                <div className="news-title">{TEAM_CONFIG.displayName} News</div>
                {lastFetch && (
                  <div className="news-updated">Updated {timeAgo(lastFetch.toISOString())} · {articles.length} articles</div>
                )}
              </div>
              <button className="news-refresh-btn" onClick={fetchArticles} disabled={loading}
                aria-label="Refresh news">
                {loading ? '…' : '↻'}
              </button>
            </div>

            {/* Source filter chips — built from actual data */}
            <div className="news-filter-chips">
              {availableSources.map(s => (
                <button
                  key={s}
                  className={`news-chip ${filter === s ? 'active' : ''}`}
                  onClick={() => { setFilter(s); if (s !== 'all') capture('news_filter_changed', { source: s }); }}
                >
                  {s === 'all' ? `All (${articles.length})` : (SOURCE_META[s]?.label || s)}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          {loading && (
            <div className="news-loading">
              {[1,2,3,4].map(i => (
                <div key={i} className="news-skeleton card">
                  <div className="skel skel-badge" />
                  <div className="skel skel-title" />
                  <div className="skel skel-text" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="news-error card">
              <div className="news-error-icon">📰</div>
              <div className="news-error-msg">{error}</div>
              <button className="news-refresh-btn" onClick={fetchArticles}>Try again</button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="news-empty card">
              <div className="news-error-icon">📰</div>
              <div>No articles found{filter !== 'all' ? ` from ${SOURCE_META[filter]?.label || filter}` : ''}.</div>
            </div>
          )}

          {!loading && !error && paginated.length > 0 && (
            <>
              <div className="news-feed">
                {paginated.map((item, i) => <ArticleCard key={`${item.id}-${i}`} item={item} />)}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="news-pagination">
                  <button
                    className="news-page-btn"
                    onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={page === 1}
                  >← Prev</button>
                  <span className="news-page-info">{page} / {totalPages}</span>
                  <button
                    className="news-page-btn"
                    onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    disabled={page === totalPages}
                  >Next →</button>
                </div>
              )}
            </>
          )}

          <div className="news-footer">
            Articles from team blogs, ESPN, Sportsnet, Bleacher Report, The Athletic, and Reddit.
            Tap any article to read the full story.
          </div>
        </>
      )}
    </div>
  );
}
