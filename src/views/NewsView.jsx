import { useState, useEffect, useCallback } from 'react';
import './NewsView.css';

const WORKER_URL  = import.meta.env.VITE_WORKER_URL || '';
const SOURCE_META = {
  nhl:          { label: 'NHL.com',       color: '#ffffff', bg: '#000000' },
  espn:         { label: 'ESPN',          color: '#ffffff', bg: '#cc0000' },
  sportsnet:    { label: 'Sportsnet',     color: '#000000', bg: '#d4a017' },
  canescountry: { label: 'Canes Country', color: '#ffffff', bg: '#cc2200' },
};

function timeAgo(isoDate) {
  if (!isoDate) return '';
  const diff = (Date.now() - new Date(isoDate)) / 1000;
  if (diff < 60)       return 'just now';
  if (diff < 3600)     return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)   return `${Math.floor(diff / 86400)}d ago`;
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function SourceBadge({ sourceId }) {
  const meta = SOURCE_META[sourceId] || { label: sourceId, color: '#fff', bg: '#555' };
  return (
    <span
      className="news-source-badge"
      style={{ background: meta.bg, color: meta.color }}
    >{meta.label}</span>
  );
}

function ArticleCard({ item }) {
  const handleClick = () => {
    if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer');
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
          <SourceBadge sourceId={item.source} />
          <span className="news-card-time">{timeAgo(item.publishedAt)}</span>
        </div>
        <h3 className="news-card-title">{item.title}</h3>
        {item.excerpt && (
          <p className="news-card-excerpt">{item.excerpt}</p>
        )}
      </div>
      <div className="news-card-arrow">→</div>
    </article>
  );
}

export default function NewsView() {
  const [articles, setArticles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [filter,   setFilter]   = useState('all');

  const fetchArticles = useCallback(async () => {
    if (!WORKER_URL) { setError('Worker URL not configured'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${WORKER_URL}/cache/${encodeURIComponent('news:CAR')}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('News not yet available — check back soon');
      const data = await res.json();
      setArticles(Array.isArray(data) ? data : []);
      setLastFetch(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const sources = ['all', ...Object.keys(SOURCE_META)];
  const filtered = filter === 'all'
    ? articles
    : articles.filter(a => a.source === filter);

  return (
    <div className="news-view page">
      {/* Header */}
      <div className="news-header card">
        <div className="news-header-row">
          <div>
            <div className="news-title">🌀 Canes News</div>
            {lastFetch && (
              <div className="news-updated">Updated {timeAgo(lastFetch.toISOString())}</div>
            )}
          </div>
          <button className="news-refresh-btn" onClick={fetchArticles} disabled={loading}
            aria-label="Refresh news">
            {loading ? '…' : '↻'}
          </button>
        </div>

        {/* Source filter chips */}
        <div className="news-filter-chips">
          {sources.map(s => (
            <button
              key={s}
              className={`news-chip ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(s)}
            >
              {s === 'all' ? 'All' : (SOURCE_META[s]?.label || s)}
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
          <div>No articles found{filter !== 'all' ? ` from ${SOURCE_META[filter]?.label}` : ''}.</div>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="news-feed">
          {filtered.map(item => <ArticleCard key={item.id} item={item} />)}
        </div>
      )}

      <div className="news-footer">
        Articles from NHL.com, ESPN, Sportsnet, and Canes Country.
        Tap any article to read the full story.
      </div>
    </div>
  );
}
