import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import './InfoTip.css';

export default function InfoTip({ label, text, position = 'auto' }) {
  const [open,  setOpen]  = useState(false);
  const [style, setStyle] = useState({ visibility: 'hidden' });
  const wrapRef  = useRef(null);
  const popupRef = useRef(null);

  // useLayoutEffect runs synchronously after DOM paint — dimensions are real
  useLayoutEffect(() => {
    if (!open || !popupRef.current || !wrapRef.current) return;

    const wrap   = wrapRef.current.getBoundingClientRect();
    const popup  = popupRef.current.getBoundingClientRect();
    const vw     = window.innerWidth;
    const vh     = window.innerHeight;
    const popW   = popup.width  || 220;
    const popH   = popup.height || 120;
    const margin = 10;

    // Vertical: prefer above the trigger if it fits, else below
    const spaceAbove = wrap.top;
    const spaceBelow = vh - wrap.bottom;
    const useAbove   = position === 'above'
      || (position !== 'below' && spaceAbove >= popH + 8 && spaceBelow < popH + 8);
    const top = useAbove
      ? wrap.top - popH - 8
      : wrap.bottom + 8;

    // Horizontal: center on trigger, clamped within viewport
    let left = wrap.left + wrap.width / 2 - popW / 2;
    left = Math.max(margin, Math.min(left, vw - popW - margin));

    setStyle({ position: 'fixed', top, left, transform: 'none', visibility: 'visible' });
  }, [open, position]);

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!open) setStyle({ visibility: 'hidden' }); // hide until positioned
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
          className="info-tip-popup"
          role="tooltip"
          style={style}
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
