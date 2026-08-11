// components/DisabledHint.jsx
// Tiny tap-triggered tooltip for a disabled chip row (Session 77 follow-up
// — live-game handling). Native `title` on the chip row already covers
// desktop hover for free; this covers mobile tap, which `title` doesn't
// reliably respond to. Deliberately simple compared to InfoTip.jsx (no
// viewport-edge clamping math) — this always renders directly under a
// compact selector row that sits well inset from the screen edge in
// practice, not a component meant to float near arbitrary edge content.
import { useEffect, useRef } from 'react';

// .disabled-hint-popup migrated to Tailwind (Phase 5, ShotMapView.css
// sub-PR 6, the final sub-PR for that file) -- kept as a literal marker,
// asserted on directly by shot-map.cy.js.
const DISABLED_HINT_POPUP_CLASSES = 'disabled-hint-popup absolute top-[calc(100%+4px)] right-0 z-20 py-[6px] px-[10px] text-[11px] text-[color:var(--text)] bg-[var(--bg2)] border-[0.5px] border-[color:var(--border-2)] rounded-[8px] shadow-[0_8px_24px_rgba(0,0,0,0.35)] whitespace-nowrap';

export default function DisabledHint({ text, active, onDismiss }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active) return;
    function close(e) {
      if (!ref.current?.contains(e.target)) onDismiss();
    }
    const outsideTimer = setTimeout(() => {
      document.addEventListener('mousedown', close);
      document.addEventListener('touchstart', close, { passive: true });
    }, 50);
    const autoTimer = setTimeout(onDismiss, 3000);
    return () => {
      clearTimeout(outsideTimer);
      clearTimeout(autoTimer);
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [active, onDismiss]);

  if (!active) return null;
  return (
    <div ref={ref} className={DISABLED_HINT_POPUP_CLASSES} role="tooltip" onClick={e => e.stopPropagation()}>
      {text}
    </div>
  );
}
