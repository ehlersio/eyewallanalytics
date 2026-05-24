import { useState, useEffect, useRef } from 'react';
import './InfoTip.css';

/**
 * Tap-to-open info popup — mobile-friendly replacement for title= tooltips.
 * Usage:
 *   <InfoTip text="Corsi = all shot attempts..." />
 *   <InfoTip label="CF%" text="Corsi For%: CAR share of all shot attempts." />
 *
 * The ⓘ button opens a popup anchored below-left. Closes on outside tap/click.
 */
export default function InfoTip({ label, text, position = 'below' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function close(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close, { passive: true });
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  return (
    <span className="info-tip-wrap" ref={wrapRef}>
      <button
        className="info-tip-btn"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        aria-label={label ? `Info about ${label}` : 'More information'}
        aria-expanded={open}
      >ⓘ</button>
      {open && (
        <div className={`info-tip-popup info-tip-${position}`} role="tooltip">
          {label && <div className="info-tip-title">{label}</div>}
          <p className="info-tip-body">{text}</p>
          <button className="info-tip-close" onClick={() => setOpen(false)}>✕</button>
        </div>
      )}
    </span>
  );
}
