import { useState, useEffect, useRef } from 'react';
import './AboutPopup.css';

// Inline SVGs — replaces Font Awesome CDN (saves 19 KiB render-blocking CSS)
function IconInstagram() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9 114.9-51.3 114.9-114.9S287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"/>
    </svg>
  );
}
function IconX() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <path d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8l164.9-188.5L26.8 48h145.6l100.5 132.9L389.2 48zm-24.8 373.8h39.1L151.1 88h-42l255.3 333.8z"/>
    </svg>
  );
}
function IconReddit() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <path d="M440.3 203.5c-15 0-28.2 6.2-37.9 15.9-35.7-24.7-83.8-40.6-137.1-42.3L293 52.3l88.2 19.8c0 21.6 17.6 39.2 39.2 39.2 21.6 0 39.2-17.6 39.2-39.2S442 32.9 420.4 32.9c-14.4 0-28.2 9.1-34.4 23.5l-97.1-21.6c-2.6-.5-5.2.5-6.8 2.6s-2.1 4.7-1 7.3l-17.6 103c-53.9 1.6-102 17.6-137.7 42.3-9.7-9.7-22.9-15.9-37.9-15.9-54.4 0-76 71.5-23.5 96.2-1.6 7.3-2.6 15-2.6 22.9 0 63.6 74.4 115.6 166.1 115.6s166.1-52 166.1-115.6c0-7.8-1-15.6-2.6-22.9 52.5-24.7 30.9-96.2-23.5-96.2zM176.8 315.4c0-21.6 17.6-39.2 39.2-39.2 21.6 0 39.2 17.6 39.2 39.2 0 21.6-17.6 39.2-39.2 39.2-21.7 0-39.2-17.6-39.2-39.2zm215.4 93.8c-26.3 26.3-76 28.2-101.7 28.2s-75.4-1.9-101.7-28.2c-4.2-4.2-4.2-10.9 0-15.2 4.2-4.2 10.9-4.2 15.2 0 17.1 17.1 56.3 23.5 86.6 23.5s69.5-6.4 86.6-23.5c4.2-4.2 10.9-4.2 15.2 0 3.6 4.3 3.6 11-.2 15.2zm-1.6-54.6c-21.6 0-39.2-17.6-39.2-39.2 0-21.6 17.6-39.2 39.2-39.2 21.6 0 39.2 17.6 39.2 39.2 0 21.7-17.6 39.2-39.2 39.2z"/>
    </svg>
  );
}
function IconFacebook() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <path d="M512 256C512 114.6 397.4 0 256 0S0 114.6 0 256c0 127.8 93.6 233.7 216 252.9V330.9h-65v-74.9h65v-57.1c0-64.1 38.2-99.6 96.7-99.6 28 0 57.3 5 57.3 5v63h-32.3c-31.8 0-41.7 19.7-41.7 39.9v48h71l-11.4 74.9H296v178c122.4-19.2 216-125.1 216-253z"/>
    </svg>
  );
}

export default function AboutPopup({ isLive = false }) {
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
        {!isLive && (
          <div>
            <div className="topbar-name">EyeWall Analytics</div>
            <div className="topbar-sub">Carolina Hurricanes</div>
          </div>
        )}
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
            Real-time shot maps, advanced stats, and game intelligence for Huge Caniacs
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

          <div className="about-social">
            <a href="https://www.instagram.com/eyewallanalytics" target="_blank" rel="noopener noreferrer" className="about-social-link" aria-label="Instagram">
              <IconInstagram />
            </a>
            <a href="https://x.com/eyewallstats" target="_blank" rel="noopener noreferrer" className="about-social-link" aria-label="X / Twitter">
              <IconX />
            </a>
            <a href="https://www.reddit.com/user/eyewallanalytics" target="_blank" rel="noopener noreferrer" className="about-social-link" aria-label="Reddit">
              <IconReddit />
            </a>
            <a href="https://www.facebook.com/profile.php?id=61590095322617" target="_blank" rel="noopener noreferrer" className="about-social-link" aria-label="Facebook">
              <IconFacebook />
            </a>
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

          <div className="about-contact">
            For all inquiries:{' '}
            <a href="mailto:matt@eyewallanalytics.com" className="about-email">
              matt@eyewallanalytics.com
            </a>
          </div>

          <div className="about-privacy">
            EyeWall uses anonymous analytics (PostHog) to understand which
            features are most useful. No personal data is sold or shared.
          </div>
        </div>
      )}
    </div>
  );
}
