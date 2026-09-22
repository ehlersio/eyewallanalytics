// src/components/GoalReplay.jsx
// One NHL goal, two ways: the NHL's video clip, or EyeWall's rendering of
// the same goal from the NHL's player and puck tracking
// (GoalTrackingReplay). A Video | Tracking switch appears only when both
// exist; with just one, that one is shown on its own, and with neither,
// nothing -- so neither option is ever offered empty. Tracking exists for
// every goal from 2023-24 on (the Worker's /nhl/goal-replay 404s otherwise,
// and for a live goal the NHL hasn't published yet).
//
// Video is the default, as it was before Tracking existed. Switching to
// Tracking plays it once.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetch } from '../hooks/useFetch';
import { getGoalReplay } from '../utils/nhlApi';
import GoalTrackingReplay from './GoalTrackingReplay';

const SWITCH_CLASSES = 'goal-replay-switch flex bg-[var(--btn-fill)] rounded-[20px] overflow-hidden w-fit mb-2';
const switchBtnClasses = (on) => {
  const base = 'goal-replay-switch-btn py-0.5 px-2.5 text-[10px] font-medium whitespace-nowrap min-h-0 min-w-0';
  return on
    ? `${base} on bg-[var(--red-dim)] text-[color:var(--red-bright)]`
    : `${base} bg-transparent text-[color:var(--text-muted)]`;
};

export default function GoalReplay({ gameId, eventId, videoUrl, videoTitle, videoClassName, scorerName }) {
  const { t } = useTranslation();
  const { data } = useFetch(() => getGoalReplay(gameId, eventId), [gameId, eventId]);
  const [mode, setMode] = useState('video');
  // Hold the replay once it has loaded. useFetch's data is null again
  // while it refetches, and dropping it mid-view would throw a viewer
  // watching Tracking back to Video. A different goal gets a different
  // key at both call sites, so this never holds the wrong goal's replay.
  const [replay, setReplay] = useState(null);
  useEffect(() => { if (data) setReplay(data); }, [data]);

  const hasVideo = Boolean(videoUrl);
  const hasTracking = Boolean(replay);
  if (!hasVideo && !hasTracking) return null;
  const showing = !hasVideo ? 'tracking' : !hasTracking ? 'video' : mode;

  return (
    <div className="goal-replay">
      {hasVideo && hasTracking && (
        <div className={SWITCH_CLASSES} role="tablist">
          <button type="button" role="tab" aria-selected={showing === 'video'} className={switchBtnClasses(showing === 'video')} onClick={() => setMode('video')}>
            {t('goalReplay.video')}
          </button>
          <button type="button" role="tab" aria-selected={showing === 'tracking'} className={switchBtnClasses(showing === 'tracking')} onClick={() => setMode('tracking')}>
            {t('goalReplay.tracking')}
          </button>
        </div>
      )}
      {showing === 'video' ? (
        <iframe className={videoClassName} src={videoUrl} allow="fullscreen" allowFullScreen title={videoTitle} />
      ) : (
        <GoalTrackingReplay replay={replay} scorerName={scorerName} autoPlay={hasVideo} />
      )}
    </div>
  );
}
