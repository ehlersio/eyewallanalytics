import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './ViewportDebugOverlay.css';

// Session 53 — throwaway diagnostic for the BottomNav mobile regression
// (blank row below the nav, full-page scroll not reaching the bottom,
// "sometimes self-corrects"). No Mac/Safari Web Inspector available to
// debug this live on iPhone the way Session 43's Android bug was solved
// (chrome://inspect + adb + CDP) -- this renders the same kind of live
// measurements directly on-screen instead, readable/copyable without any
// remote-debugging tooling. Only active behind ?debug=viewport so it can't
// affect real users or Cypress runs. Delete this file + its .css + the
// mount in App.jsx once the bug is root-caused and fixed -- not meant to
// be a permanent feature.
function readSafeAreaInsets(probeEl) {
  if (!probeEl) return null;
  const cs = getComputedStyle(probeEl);
  return {
    top: cs.paddingTop,
    right: cs.paddingRight,
    bottom: cs.paddingBottom,
    left: cs.paddingLeft,
  };
}

function snapshot(probeEl) {
  const vv = window.visualViewport;
  const nav = document.querySelector('.bottom-nav');
  const main = document.querySelector('.app-main');
  const shell = document.querySelector('.app-shell');
  const navRect = nav?.getBoundingClientRect();
  const shellRect = shell?.getBoundingClientRect();

  return {
    t: new Date().toISOString().slice(11, 23),
    innerWH: `${window.innerWidth}x${window.innerHeight}`,
    docClientH: document.documentElement.clientHeight,
    vv: vv ? `${vv.width.toFixed(0)}x${vv.height.toFixed(0)} off=${vv.offsetTop.toFixed(0)} scale=${vv.scale.toFixed(2)}` : 'n/a',
    standalone: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,
    safeArea: readSafeAreaInsets(probeEl),
    shellH: shellRect ? shellRect.height.toFixed(1) : 'no .app-shell',
    bodyPosition: getComputedStyle(document.body).position,
    bodyTop: getComputedStyle(document.body).top,
    navRect: navRect
      ? { top: navRect.top.toFixed(1), bottom: navRect.bottom.toFixed(1), height: navRect.height.toFixed(1), gapBelow: (window.innerHeight - navRect.bottom).toFixed(1) }
      : 'no .bottom-nav found',
    mainScroll: main
      ? { scrollTop: main.scrollTop.toFixed(1), scrollHeight: main.scrollHeight, clientHeight: main.clientHeight, gapToBottom: (main.scrollHeight - main.scrollTop - main.clientHeight).toFixed(1) }
      : 'no .app-main found',
  };
}

export default function ViewportDebugOverlay() {
  const enabled = new URLSearchParams(window.location.search).get('debug') === 'viewport';
  const location = useLocation();
  const [expanded, setExpanded] = useState(true);
  const [current, setCurrent] = useState(null);
  const [log, setLog] = useState([]);
  const probeRef = useRef(null);
  const lastKeyRef = useRef('');

  useEffect(() => {
    if (!enabled) return;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);' +
      'padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px);';
    document.body.appendChild(probe);
    probeRef.current = probe;

    const sample = (reason) => {
      const snap = snapshot(probe);
      setCurrent(snap);
      const key = JSON.stringify(snap.navRect) + JSON.stringify(snap.mainScroll) + snap.innerWH + snap.vv;
      if (key !== lastKeyRef.current) {
        lastKeyRef.current = key;
        setLog((prev) => [...prev.slice(-99), { ...snap, reason }]);
      }
    };

    sample('mount');
    const interval = setInterval(() => sample('poll'), 500);
    const onResize = () => sample('resize');
    const onScroll = () => sample('scroll');
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('scroll', onResize);
    document.querySelector('.app-main')?.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('scroll', onResize);
      document.querySelector('.app-main')?.removeEventListener('scroll', onScroll);
      probe.remove();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    setLog((prev) => [...prev, { t: new Date().toISOString().slice(11, 23), reason: `nav:${location.pathname}` }]);
  }, [location.pathname, enabled]);

  if (!enabled) return null;

  const copyLog = () => {
    const text = log.map((l) => JSON.stringify(l)).join('\n');
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <div className={`vdo-root ${expanded ? 'vdo-expanded' : ''}`}>
      <button className="vdo-toggle" onClick={() => setExpanded((e) => !e)}>
        {expanded ? 'hide debug' : '🐛'}
      </button>
      {expanded && (
        <div className="vdo-panel">
          <div className="vdo-current">
            <pre>{JSON.stringify(current, null, 2)}</pre>
          </div>
          <div className="vdo-actions">
            <button onClick={copyLog}>Copy log ({log.length})</button>
            <button onClick={() => setLog([])}>Clear</button>
          </div>
          <div className="vdo-log">
            {log.slice(-20).reverse().map((l, i) => (
              <div key={i} className="vdo-log-row">{l.t} [{l.reason}] {l.navRect ? JSON.stringify(l.navRect) : ''} {l.mainScroll ? JSON.stringify(l.mainScroll) : ''}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
