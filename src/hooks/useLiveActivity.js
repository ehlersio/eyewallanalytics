/**
 * Lock Screen Live Activities for the favorite team's NHL games (iOS app).
 *
 * "Follow my team's games" (Settings) is the one control. With it on:
 *   - eyewall-poller STARTS the activity when the team's game goes live,
 *     whether or not the app is open (ActivityKit push-to-start, iOS 17.2+).
 *     The native LiveActivityRegistrar (ios/App/App/SceneDelegate.swift)
 *     registers the start token and every activity's update token with the
 *     Worker; nothing here handles tokens.
 *   - useLiveActivity() starts it from the app too, when the app is open
 *     during the game and no activity exists yet -- the setting was turned
 *     on mid-game, or the server's start didn't arrive. Once per game: an
 *     activity the user swiped away isn't brought back.
 * The per-game "Follow on Lock Screen" button this replaced was removed:
 * the user had to tap it every game, with the app open.
 */
import { useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { getTeamByAbbr, TEAM_CONFIG } from '../utils/teamConfig';
import { getSport } from '../utils/SportContext';
import { getLocale } from '../utils/localeConfig';

const LiveGame = registerPlugin('LiveGame');
const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
const STARTED_KEY = gameId => `eyewall:la-started:${gameId}`;
export const AUTO_FOLLOW_EVENT = 'eyewall:la-auto-follow-changed';

// "1st".."3rd", "OT", "SO", playoff "2OT" -- same labels the poller pushes.
function periodLabel(pd, gameType) {
  const n = pd?.number;
  if (!n) return '';
  if (n <= 3) return ['1st', '2nd', '3rd'][n - 1];
  if (pd.periodType === 'SO' || (gameType !== 3 && n >= 5)) return 'SO';
  return n === 4 ? 'OT' : `${n - 3}OT`;
}

// The setting only exists for an NHL favorite in the iOS app on 17.2+ with
// Live Activities allowed -- anywhere else the Settings row isn't shown.
export async function autoFollowSupported() {
  if (!Capacitor.isNativePlatform() || getSport() !== 'nhl') return false;
  try {
    return (await LiveGame.autoFollowSupported()).supported === true;
  } catch {
    return false; // a build without the method
  }
}

export async function getAutoFollow() {
  try {
    return (await LiveGame.getAutoFollow()).enabled === true;
  } catch {
    return false;
  }
}

export async function setAutoFollow(enabled) {
  await LiveGame.setAutoFollow({
    enabled, team: TEAM_CONFIG.abbr, locale: getLocale(), workerUrl: WORKER_URL,
  });
  window.dispatchEvent(new window.CustomEvent(AUTO_FOLLOW_EVENT, { detail: enabled }));
}

// On every launch (and a language change): re-sends the current favorite
// team and language with the setting, so the poller's registration follows
// a team switch or a language toggle.
export async function syncAutoFollow() {
  if (!(await autoFollowSupported())) return;
  const enabled = await getAutoFollow();
  if (enabled) await setAutoFollow(true).catch(() => {});
}

export function useLiveActivity(game, pbp, followAbbr) {
  const gameId = game?.id;

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !gameId || !game) return undefined;
    let cancelled = false;
    const startIfFollowing = async () => {
      try {
        if (localStorage.getItem(STARTED_KEY(gameId))) return;
      } catch { /* storage unavailable: fall through */ }
      const [{ supported }, enabled] = await Promise.all([LiveGame.isSupported(), getAutoFollow()]);
      if (cancelled || !supported || !enabled) return;
      const { gameIds } = await LiveGame.activeGameIds();
      if (cancelled) return;
      if (!gameIds.includes(gameId)) {
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
      }
      try { localStorage.setItem(STARTED_KEY(gameId), '1'); } catch { /* ignore */ }
    };
    startIfFollowing().catch(() => {});
    // Turning the setting on mid-game starts it straight away.
    const onChange = (e) => { if (e.detail) startIfFollowing().catch(() => {}); };
    window.addEventListener(AUTO_FOLLOW_EVENT, onChange);
    return () => { cancelled = true; window.removeEventListener(AUTO_FOLLOW_EVENT, onChange); };
    // Keyed to the game: pbp/game refresh every poll, and only the first
    // frame's state is sent from here.
  }, [gameId]);
}
