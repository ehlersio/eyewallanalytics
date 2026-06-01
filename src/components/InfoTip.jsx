import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import './InfoTip.css';

export default function InfoTip({ label, text, position = 'auto' }) {
  const [open,  setOpen]  = useState(false);
  const [style, setStyle] = useState({ visibility: 'hidden' });
  const wrapRef   = useRef(null);
  const popupRef  = useRef(null);
  const passRef   = useRef(0); // 0 = not started, 1 = pass1 done, 2 = done

  useLayoutEffect(() => {
    if (!open || !popupRef.current || !wrapRef.current) return;

    const wrap   = wrapRef.current.getBoundingClientRect();
    const popup  = popupRef.current.getBoundingClientRect();
    const vw     = window.visualViewport?.width  ?? window.innerWidth;
    const vh     = window.visualViewport?.height ?? window.innerHeight;
    const popW   = popup.width || 220;
    const margin = 10;

    const triggerCenter = wrap.left + wrap.width / 2;
    let left = triggerCenter > vw / 2
      ? wrap.right - popW
      : triggerCenter - popW / 2;
    left = Math.max(margin, Math.min(left, vw - popW - margin));

    if (passRef.current === 0) {
      // Pass 1: position at final left but off-screen vertically so text
      // reflows at real width before we measure height
      passRef.current = 1;
      setStyle({ position: 'fixed', top: -9999, left, visibility: 'hidden' });
    } else if (passRef.current === 1) {
      // Pass 2: text has wrapped — popH is now accurate
      passRef.current = 2;
      const popH = popup.height;
      if (!popH) return;

      const spaceAbove = wrap.top;
      const spaceBelow = vh - wrap.bottom;
      const useAbove   = position === 'above'
        || (position !== 'below' && spaceAbove >= popH + 8 && spaceBelow < popH + 8);
      let top = useAbove ? wrap.top - popH - 8 : wrap.bottom + 8;
      top = Math.max(margin, Math.min(top, vh - popH - margin));

      setStyle({ position: 'fixed', top, left, visibility: 'visible' });
    }
    // passRef === 2: fully positioned, do nothing
  }, [open, style.left]); // style.left changes after pass 1 → triggers pass 2

  const handleOpen = (e) => {
    e.stopPropagation();
    passRef.current = 0;
    setStyle({ position: 'fixed', top: -9999, left: -9999, visibility: 'hidden' });
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
