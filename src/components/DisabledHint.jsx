// components/DisabledHint.jsx
// Tiny tap-triggered tooltip for a disabled chip row (Session 77 follow-up
// — live-game handling). Native `title` on the chip row already covers
// desktop hover for free; this covers mobile tap, which `title` doesn't
// reliably respond to. Deliberately simple compared to InfoTip.jsx (no
// viewport-edge clamping math) — this always renders directly under a
// compact selector row that sits well inset from the screen edge in
// practice, not a component meant to float near arbitrary edge content.
import { useEffect, useRef } from 'react';

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
    <div ref={ref} className="disabled-hint-popup" role="tooltip" onClick={e => e.stopPropagation()}>
      {text}
    </div>
  );
}
