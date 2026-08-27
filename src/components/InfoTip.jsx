import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// Tailwind migration (Session 95, Phase 1) -- previously InfoTip.css.
const WRAP_CLASSES = 'relative inline-flex items-center align-middle';
const BTN_CLASSES = 'bg-transparent border-0 cursor-pointer text-[12px] text-[color:var(--text-dim)] px-0.5 py-0 leading-none rounded-full transition-colors duration-150 align-middle hover:text-[color:var(--text-muted)] focus-visible:text-[color:var(--text-muted)] focus-visible:outline-none';
// whitespace-normal is required, not decorative -- InfoTip renders inside
// several compact labels that set `white-space: nowrap` (e.g. PlayersView's
// .pa-ctx-label), and white-space is an inherited property, so without this
// the popup's own body text would inherit nowrap from wherever it's nested
// and refuse to wrap.
const POPUP_CLASSES = 'fixed z-[9999] bg-[var(--bg1)] border-[0.5px] border-[var(--border-2)] rounded-[10px] pt-3 px-3.5 pb-2.5 w-[220px] max-w-[calc(100vw-20px)] shadow-[0_8px_32px_rgba(0,0,0,0.55)] whitespace-normal';
const TITLE_CLASSES = 'text-[12px] font-bold text-[color:var(--text)] mb-[5px] pr-[18px]';
const BODY_CLASSES = 'text-[12px] text-[color:var(--text-muted)] leading-[1.5] m-0';
const SECTION_LABEL_CLASSES = 'text-[10px] font-bold text-[color:var(--text-dim)] uppercase tracking-[0.04em] mb-0.5';
const CLOSE_CLASSES = 'absolute top-1.5 right-2 bg-transparent border-0 text-[13px] text-[color:var(--text-dim)] cursor-pointer px-1 py-0.5 leading-none hover:text-[color:var(--text)]';

export default function InfoTip({ label, text, sections, position = 'auto' }) {
  const { t } = useTranslation();
  const items = sections ?? (text ? [{ text }] : []);
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
    // Small delay prevents the opening tap from immediately triggering close
    // (touchstart fires on the same gesture that opened the tip on some mobile browsers)
    function close(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    const timerId = setTimeout(() => {
      document.addEventListener('mousedown',  close);
      document.addEventListener('touchstart', close, { passive: true });
    }, 50);
    return () => {
      clearTimeout(timerId);
      document.removeEventListener('mousedown',  close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  return (
    <span className={WRAP_CLASSES} ref={wrapRef}>
      <button
        className={BTN_CLASSES}
        onClick={handleOpen}
        aria-label={label ? t('infoTip.aboutLabel', { label }) : t('infoTip.moreInfo')}
        aria-expanded={open}
      >ⓘ</button>
      {open && (
        <div
          ref={popupRef}
          className={POPUP_CLASSES}
          role="tooltip"
          style={style}
          onClick={e => e.stopPropagation()}
        >
          {label && <div className={TITLE_CLASSES}>{label}</div>}
          {items.map((s, i) => (
            <div className={i > 0 ? 'mt-2' : ''} key={i}>
              {s.label && <div className={SECTION_LABEL_CLASSES}>{s.label}</div>}
              <p className={BODY_CLASSES}>{s.text}</p>
            </div>
          ))}
          <button className={CLOSE_CLASSES} onClick={() => setOpen(false)}>✕</button>
        </div>
      )}
    </span>
  );
}
