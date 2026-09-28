// components/SheetParts.jsx -- what the top bar's panels share: Settings
// (SettingsMenu.jsx) and the notifications bell (NotificationsBell.jsx).
// The same sheet, header, title, grouped sections and rows, so the two
// read as one app.
//
// Marker class names the tests select on (notif-popup, notif-title,
// notif-close for Settings; summary-bell-* for the bell) are added by each
// panel, not here.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Rendered into <body> (a portal): inside the top bar it could never sit
// above the bottom nav, whatever its z-index. Phones: the whole screen,
// clear of the notch and home indicator. Wider: a panel under its button,
// placed from the button's position (see useSheet's `anchor`).
export const PANEL_CLASSES = 'fixed z-[600] bg-[var(--bg1)] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] '
  + 'inset-0 pt-[max(12px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] px-4 animate-[sheetIn_0.2s_ease-out] '
  + 'min-[701px]:inset-auto min-[701px]:w-[380px] min-[701px]:max-h-[min(640px,calc(100vh-90px))] min-[701px]:p-4 min-[701px]:rounded-[16px] min-[701px]:border-[0.5px] min-[701px]:border-[var(--border-2)] min-[701px]:shadow-[var(--popup-shadow)] min-[701px]:animate-[popupIn_0.18s_cubic-bezier(0.34,1.56,0.64,1)]';
const WIDE_QUERY = '(min-width: 701px)';
export const HEADER_ROW_CLASSES = 'flex items-center justify-between min-h-[44px]';
export const CLOSE_CLASSES = 'w-11 h-11 flex items-center justify-center rounded-full border-0 bg-[var(--btn-fill)] text-[15px] text-[color:var(--text-muted)] cursor-pointer hover:bg-[var(--btn-fill-hover)] hover:text-[color:var(--text)]';
export const BACK_CLASSES = 'flex items-center gap-1 min-h-[44px] pr-2 border-0 bg-transparent text-[15px] font-semibold text-[color:var(--team-primary)] cursor-pointer';
export const TITLE_CLASSES = 'm-0 mb-4 font-[family-name:var(--font-display)] text-[30px] font-extrabold leading-none text-[color:var(--text)]';
export const SECTIONS_CLASSES = 'flex flex-col gap-5';
export const SECTION_LABEL_CLASSES = 'text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-dim)] px-1 pb-1.5';
const GROUP_CLASSES = 'bg-[var(--bg2)] border-[0.5px] border-[var(--border)] rounded-[14px] overflow-hidden divide-y divide-[var(--border)]';
export const ROW_CLASSES = 'flex items-center gap-3 px-3.5 py-2.5 min-h-[52px] w-full text-left';
export const ROW_BUTTON_CLASSES = `${ROW_CLASSES} border-0 bg-transparent cursor-pointer text-[color:var(--text)] hover:bg-[var(--btn-fill)]`;
export const ROW_TEXT_CLASSES = 'flex flex-col gap-0.5 flex-1 min-w-0';
export const ROW_TITLE_CLASSES = 'text-[15px] font-semibold text-[color:var(--text)] leading-tight';
export const ROW_SUB_CLASSES = 'text-[12px] text-[color:var(--text-muted)] leading-snug';
export const ROW_VALUE_CLASSES = 'text-[14px] text-[color:var(--text-muted)] whitespace-nowrap';
export const CHEVRON_CLASSES = 'text-[18px] leading-none text-[color:var(--text-dim)]';
export const ICON_CLASSES = 'w-[30px] h-[30px] rounded-[8px] bg-[var(--bg3)] flex items-center justify-center text-[15px] shrink-0';
const FOOT_CLASSES = 'text-[12px] text-[color:var(--text-dim)] leading-snug px-1 pt-1.5';

// One top-bar panel open at a time: opening one tells the others.
const SHEET_OPEN_EVENT = 'eyewall:sheet-open';

export function Section({ label, footer, children }) {
  return (
    <section>
      {label && <h2 className={SECTION_LABEL_CLASSES}>{label}</h2>}
      <div className={GROUP_CLASSES}>{children}</div>
      {footer && <p className={FOOT_CLASSES}>{footer}</p>}
    </section>
  );
}

// Open/close state for a panel hanging off `triggerRef`'s button: where it
// hangs on wide screens, Escape to close, and closing any other panel that
// was open. `onClose` runs on every close (e.g. back to a first screen).
export function useSheet(id, triggerRef, onClose) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const closeSheet = useCallback(() => {
    setOpen(false);
    onCloseRef.current?.();
  }, []);

  const openSheet = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    setAnchor(r && window.matchMedia(WIDE_QUERY).matches
      ? { top: r.bottom + 10, right: Math.max(12, window.innerWidth - r.right) }
      : null);
    setOpen(true);
    window.dispatchEvent(new window.CustomEvent(SHEET_OPEN_EVENT, { detail: id }));
  }, [id, triggerRef]);

  useEffect(() => {
    const onOther = e => { if (e.detail !== id) closeSheet(); };
    window.addEventListener(SHEET_OPEN_EVENT, onOther);
    return () => window.removeEventListener(SHEET_OPEN_EVENT, onOther);
  }, [id, closeSheet]);

  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') closeSheet(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, closeSheet]);

  return { open, anchor, openSheet, closeSheet };
}

export function Sheet({ className = '', anchor, label, children }) {
  return createPortal(
    <div className={`${className} ${PANEL_CLASSES}`} style={anchor || undefined} role="dialog" aria-modal="true" aria-label={label}>
      {children}
    </div>,
    document.body
  );
}
