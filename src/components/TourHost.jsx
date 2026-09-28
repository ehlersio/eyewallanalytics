// components/TourHost.jsx -- when the app tour (utils/tour.js) runs.
//
// On the team's home page, once it has settled (the faceoff intro gone,
// the page's stops rendered):
//   - just picked a first team: the tour starts;
//   - using the app from before the tour existed: a one-time card invites
//     them to take it (Take the tour / Not now).
// Settings > Help > Take the tour (START_TOUR_EVENT) replays it from
// anywhere, going to the home page first.
//
// Marker classes for Cypress: tour-invite, tour-invite-start,
// tour-invite-dismiss (driver.js's own popover is .eyewall-tour).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { capture } from '../utils/analytics';
import { loadTourState, saveTourState, startTour, START_TOUR_EVENT, TOUR_ROOTS, tourAction } from '../utils/tour';

const INVITE_CLASSES = 'tour-invite fixed left-3 right-3 z-[550] bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom,0px)+12px)] min-[701px]:left-auto min-[701px]:w-[360px] bg-[var(--bg1)] border-[0.5px] border-[var(--border-2)] rounded-[16px] shadow-[var(--popup-shadow)] p-4 flex flex-col gap-3 animate-[sheetIn_0.2s_ease-out]';
const INVITE_TITLE_CLASSES = 'm-0 font-[family-name:var(--font-display)] text-[20px] font-extrabold leading-tight text-[color:var(--text)]';
const INVITE_BODY_CLASSES = 'm-0 text-[14px] leading-[1.45] text-[color:var(--text-muted)]';
const INVITE_ACTIONS_CLASSES = 'flex gap-2';
const PRIMARY_BTN_CLASSES = 'tour-invite-start flex-1 min-h-[44px] rounded-[12px] border-0 bg-[var(--red-bright)] text-white text-[14px] font-bold cursor-pointer hover:opacity-90';
const SECONDARY_BTN_CLASSES = 'tour-invite-dismiss min-h-[44px] px-4 rounded-[12px] border-0 bg-[var(--btn-fill)] text-[color:var(--text-muted)] text-[14px] font-semibold cursor-pointer hover:bg-[var(--btn-fill-hover)]';

const SETTLE_POLL_MS = 400;
const SETTLE_MAX_MS = 15000;
const SETTLE_EXTRA_MS = 700; // let the page's cards finish arriving

const homeRoot = () => TOUR_ROOTS[localStorage.getItem('eyewall:sport') || 'nhl'] || '/';

// Resolves once the intro has gone and the page's frame is there, or
// after SETTLE_MAX_MS whatever state it's in.
function whenSettled() {
  return new Promise(resolve => {
    const started = Date.now();
    const check = () => {
      const settled = !document.querySelector('.faceoff-intro') && document.querySelector('.bottom-nav')
        && (document.querySelector('.score-card') || document.querySelector('[data-tour="rink"]'));
      if (settled || Date.now() - started > SETTLE_MAX_MS) setTimeout(resolve, SETTLE_EXTRA_MS);
      else setTimeout(check, SETTLE_POLL_MS);
    };
    check();
  });
}

export default function TourHost() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(false);
  const replayPending = useRef(false);
  const onHome = location.pathname === homeRoot();

  const run = useCallback(async trigger => {
    setInvite(false);
    await whenSettled();
    await startTour(t, trigger);
  }, [t]);

  // First visit to the home page on this load: start, invite, or nothing.
  useEffect(() => {
    if (!onHome) return;
    if (replayPending.current) {
      replayPending.current = false;
      run('settings');
      return;
    }
    const action = tourAction(loadTourState());
    if (action === 'start') {
      run('firstTeam');
    } else if (action === 'invite') {
      let cancelled = false;
      whenSettled().then(() => {
        if (!cancelled) { setInvite(true); capture('tour_invited'); }
      });
      return () => { cancelled = true; };
    }
  }, [onHome, run]);

  // Settings > Help > Take the tour.
  useEffect(() => {
    const onStart = () => {
      if (window.location.pathname === homeRoot()) run('settings');
      else { replayPending.current = true; navigate(homeRoot()); }
    };
    window.addEventListener(START_TOUR_EVENT, onStart);
    return () => window.removeEventListener(START_TOUR_EVENT, onStart);
  }, [navigate, run]);

  if (!invite || !onHome) return null;

  const dismiss = () => {
    setInvite(false);
    saveTourState({ invited: true });
    capture('tour_invite_dismissed');
  };

  return (
    <div className={INVITE_CLASSES} role="dialog" aria-labelledby="tour-invite-title">
      <h2 id="tour-invite-title" className={INVITE_TITLE_CLASSES}>{t('tour.invite.title')}</h2>
      <p className={INVITE_BODY_CLASSES}>{t('tour.invite.body')}</p>
      <div className={INVITE_ACTIONS_CLASSES}>
        <button type="button" className={PRIMARY_BTN_CLASSES} onClick={() => run('invite')}>{t('tour.invite.start')}</button>
        <button type="button" className={SECONDARY_BTN_CLASSES} onClick={dismiss}>{t('tour.invite.notNow')}</button>
      </div>
    </div>
  );
}
