/**
 * useLiveActivity — "Follow on Lock Screen" for a live NHL game (iOS app).
 *
 * Starts an iOS Live Activity for the game through the native LiveGame
 * plugin (ios/App/App/SceneDelegate.swift, drawn by the EyeWallLiveActivity
 * extension) and registers its push token with the Worker
 * (POST /live-activity/register). From then on eyewall-poller keeps it
 * current over APNs and ends it at the final -- nothing here polls.
 *
 * Returns { supported, following, follow, unfollow }. `supported` is false
 * on the web, on iOS < 16.2, and when the user has Live Activities turned
 * off for the app, so the button is simply not shown there.
 */
import { useCallback, useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { getTeamByAbbr } from '../utils/teamConfig';

const LiveGame = registerPlugin('LiveGame');
const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

// Tokens can arrive (and change) after start(), so one app-wide listener
// forwards every one to the Worker.
let tokenListener = null;
function ensureTokenListener() {
  if (tokenListener || !Capacitor.isNativePlatform()) return;
  tokenListener = LiveGame.addListener('pushToken', ({ gameId, token }) => {
    if (!WORKER_URL) return;
    fetch(`${WORKER_URL}/live-activity/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, token }),
    }).catch(() => {});
  });
}

// "1st".."3rd", "OT", "SO", playoff "2OT" -- same labels the poller pushes.
function periodLabel(pd, gameType) {
  const n = pd?.number;
  if (!n) return '';
  if (n <= 3) return ['1st', '2nd', '3rd'][n - 1];
  if (pd.periodType === 'SO' || (gameType !== 3 && n >= 5)) return 'SO';
  return n === 4 ? 'OT' : `${n - 3}OT`;
}

export function useLiveActivity(game, pbp, followAbbr) {
  const gameId = game?.id;
  const [supported, setSupported] = useState(false);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !gameId) return;
    let cancelled = false;
    LiveGame.isSupported()
      .then(({ supported: ok }) => { if (!cancelled) setSupported(ok); })
      .catch(() => {}); // a build without the plugin
    LiveGame.activeGameIds()
      .then(({ gameIds }) => { if (!cancelled) setFollowing(gameIds.includes(gameId)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [gameId]);

  const follow = useCallback(async () => {
    if (!game) return;
    ensureTokenListener();
    const home = game.homeTeam?.abbrev, away = game.awayTeam?.abbrev;
    await LiveGame.start({
      gameId,
      homeAbbr: home,
      awayAbbr: away,
      homeColor: getTeamByAbbr(home)?.displayColor,
      awayColor: getTeamByAbbr(away)?.displayColor,
      followAbbr,
      // A first frame; the poller's next minute fills in the rest.
      state: {
        homeScore: pbp?.homeTeam?.score ?? game.homeTeam?.score ?? 0,
        awayScore: pbp?.awayTeam?.score ?? game.awayTeam?.score ?? 0,
        periodLabel: periodLabel(pbp?.periodDescriptor, game.gameType),
        clock: pbp?.clock?.timeRemaining || '',
        inIntermission: !!pbp?.clock?.inIntermission,
        status: 'live',
      },
    });
    setFollowing(true);
  }, [game, gameId, pbp, followAbbr]);

  const unfollow = useCallback(async () => {
    await LiveGame.end({ gameId });
    setFollowing(false);
  }, [gameId]);

  return { supported, following, follow, unfollow };
}
