import { useState, useEffect, useRef } from 'react';
import './AboutPopup.css';

export default function AboutPopup() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close, { passive: true });
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="about-wrap">
      <button
        className="about-trigger"
        onClick={() => setOpen(o => !o)}
        aria-label="About EyeWall Analytics"
        aria-expanded={open}
      >
        <img src="/eyewall-logo.svg" alt="" className="topbar-logoimg" width="36" height="36" />
        <div>
          <div className="topbar-name">EyeWall Analytics</div>
          <div className="topbar-sub">Carolina Hurricanes</div>
        </div>
      </button>

      {open && (
        <div className="about-popup" role="dialog" aria-label="About EyeWall Analytics">
          <button className="about-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>

          <div className="about-logo-row">
            <img src="/eyewall-logo.svg" alt="EyeWall Analytics" width="48" height="48" />
            <div>
              <div className="about-title">EyeWall Analytics</div>
              <div className="about-subtitle">Carolina Hurricanes Intelligence</div>
            </div>
          </div>

          <p className="about-desc">
            Real-time shot maps, advanced stats, and game intelligence for Canes fans
            who want to go deeper than the box score. Live Corsi, Fenwick, PDO,
            puck luck, on-ice tracking, and more — all from public NHL data.
          </p>

          <div className="about-stats-row">
            <div className="about-stat">
              <span className="about-stat-val">Live</span>
              <span className="about-stat-label">Shot Maps</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-val">20s</span>
              <span className="about-stat-label">Live Poll</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-val">Free</span>
              <span className="about-stat-label">Always</span>
            </div>
          </div>

          <div className="about-divider" />

          <div className="about-support">
            <p className="about-support-text">
              EyeWall Analytics is a passion project. If you find it useful,
              buying a coffee helps keep the servers running. 🙏
            </p>
            <a
              href="https://buymeacoffee.com/mattehlers"
              target="_blank"
              rel="noopener noreferrer"
              className="bmc-btn"
            >
              <span className="bmc-icon">☕</span>
              Buy me a coffee
            </a>
          </div>

          <div className="about-divider" />

          <div className="about-footer">
            <span>Built with 🌀 for Canes Nation</span>
            <span className="about-version">Data via NHL API</span>
          </div>
        </div>
      )}
    </div>
  );
}
