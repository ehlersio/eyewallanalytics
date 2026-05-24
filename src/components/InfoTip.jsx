import { useState, useEffect, useRef, useCallback } from 'react';
import './InfoTip.css';

/**
 * Tap-to-open info popup — mobile-friendly replacement for title= tooltips.
 *
 * Props:
 *   text      — the help text to display
 *   label     — optional title shown bold above the text
 *   position  — 'auto' (default) | 'below' | 'above' | 'left'
 *
 * 'auto' measures available space after mount and picks the best position.
 */
export default function InfoTip({ label, text, position = 'auto' }) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState('below');
  const wrapRef   = useRef(null);
  const popupRef  = useRef(null);

  // Compute best position based on remaining viewport space
  const calcPos = useCallback(() => {
    if (position !== 'auto' || !wrapRef.current) {
      setPos(position === 'auto' ? 'below' : position);
      return;
    }
    const rect   = wrapRef.current.getBoundingClientRect();
    const vw     = window.innerWidth;
    const vh     = window.innerHeight;
    const popH   = 120; // estimated popup height
    const popW   = 240; // popup width
    const spaceB = vh - rect.bottom;
    const spaceT = rect.top;
    const spaceR = vw - rect.left;

    if (spaceB >= popH)       setPos('below');
    else if (spaceT >= popH)  setPos('above');
    else if (spaceR >= popW)  setPos('below'); // fallback below with overflow scroll
    else                      setPos('above');
  }, [position]);

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!open) calcPos();
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    function close(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown',  close);
    document.addEventListener('touchstart', close, { passive: true });
    return () => {
      document.removeEventListener('mousedown',  close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  return (
    <span className="info-tip-wrap" ref={wrapRef}>
      <button
        className="info-tip-btn"
        onClick={handleOpen}
        aria-label={label ? `Info about ${label}` : 'More information'}
        aria-expanded={open}
      >ⓘ</button>
      {open && (
        <div
          ref={popupRef}
          className={`info-tip-popup info-tip-${pos}`}
          role="tooltip"
          onClick={e => e.stopPropagation()}
        >
          {label && <div className="info-tip-title">{label}</div>}
          <p className="info-tip-body">{text}</p>
          <button className="info-tip-close" onClick={() => setOpen(false)}>✕</button>
        </div>
      )}
    </span>
  );
}
