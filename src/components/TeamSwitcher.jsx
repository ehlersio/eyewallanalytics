// components/TeamSwitcher.jsx -- the primary team's logo in the top bar:
// tap it for your followed teams and switch to one (Settings redesign step
// 6, option 1, 2026-09). Switching reloads the app as that team, the same
// as tapping it in Settings > Your teams -- every page, every league.
//
// Only shown when following more than one team: with one there's nothing
// to switch to.
//
// Option 2: a followed NHL team that's live right now gets "Watch live",
// which opens its game from its side without a reload -- the guest game
// view the Scoreboard opens (GuestGameView.jsx, scoreboard.js's
// teamRowHref). Only while the primary is NHL too: that view is NHL-only.
//
// Marker classes for Cypress: team-switcher (the button),
// team-switcher-panel, team-switcher-row, team-switcher-watch,
// team-switcher-manage.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getTodaysGames } from '../utils/nhlApi';
import { getTeamByAbbr } from '../utils/teamConfig';
import { teamRowHref } from '../utils/scoreboard';
import { useAuth } from '../utils/AuthContext';
import { useSport } from '../utils/SportContext';
import { getLocalSelection, getLocalSelectionFor } from '../utils/favoriteTeamSync';
import { FOLLOWED_CHANGED_EVENT, getFollowedTeams, LEAGUES, sameTeam, switchPrimaryTeam, teamFor } from '../utils/followedTeams';
import { LeagueTeamLogo } from './SettingsTeams';
import { OPEN_SETTINGS_EVENT } from './SettingsMenu';
import {
  CHEVRON_CLASSES, CLOSE_CLASSES, HEADER_ROW_CLASSES, ICON_CLASSES, ROW_BUTTON_CLASSES, ROW_CLASSES,
  ROW_SUB_CLASSES, ROW_TEXT_CLASSES, ROW_TITLE_CLASSES, SECTIONS_CLASSES, Section, Sheet, TITLE_CLASSES, useSheet,
} from './SheetParts';

const TRIGGER_CLASSES = 'team-switcher flex items-center gap-0.5 min-h-[36px] pl-1 pr-0.5 rounded-[8px] border-0 bg-transparent cursor-pointer text-[color:var(--text-dim)] hover:bg-[var(--btn-fill)]';
const WATCH_CLASSES = 'team-switcher-watch flex items-center gap-1 shrink-0 min-h-[36px] px-3 mr-3 rounded-[18px] bg-[var(--red-bright)] text-white text-[13px] font-bold no-underline hover:opacity-90';
const HERE_CLASSES = 'text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--amber)] border border-[rgba(240,160,48,0.45)] rounded-[6px] py-0.5 px-1.5 whitespace-nowrap';

const leagueLabel = sport => LEAGUES.find(l => l.sport === sport)?.label || sport.toUpperCase();

export default function TeamSwitcher() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const triggerRef = useRef(null);
  const [followed, setFollowed] = useState(getFollowedTeams);
  const [switching, setSwitching] = useState(null);
  const { open, anchor, openSheet, closeSheet } = useSheet('teams', triggerRef);
  // The team whose pages are on screen. The league comes from the route
  // (SportContext.jsx), which can be another league than the primary's --
  // a tapped notification, a link -- and that league's pages then run as
  // its own pick, so show that, not the primary (2026-10-09: an AHL team's
  // pages under the PWHL primary's logo).
  const { sport } = useSport();
  const stored = getLocalSelection();
  const primary = stored?.sport === sport ? stored : (getLocalSelectionFor(sport) || stored);
  // Today's NHL games, fetched on open, for "Watch live".
  const [todaysGames, setTodaysGames] = useState(null);
  const canWatch = primary?.sport === 'nhl'
    && followed.some(t => t.sport === 'nhl' && !sameTeam(t, primary));

  useEffect(() => {
    const onChange = e => setFollowed(e.detail || getFollowedTeams());
    window.addEventListener(FOLLOWED_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FOLLOWED_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!open || !canWatch) return;
    let cancelled = false;
    getTodaysGames().then(g => { if (!cancelled) setTodaysGames(g); }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, canWatch]);

  if (followed.length < 2 || !primary) return null;

  const handleSwitch = team => {
    setSwitching(team);
    switchPrimaryTeam(team, user?.id);
  };

  const handleManage = () => {
    closeSheet();
    window.dispatchEvent(new window.CustomEvent(OPEN_SETTINGS_EVENT, { detail: { screen: 'teams' } }));
  };

  const primaryName = teamFor(primary)?.displayName || primary.abbr;

  // A followed NHL team's live game, from its side, or null.
  const watchHref = team => {
    if (!canWatch || team.sport !== 'nhl' || !Array.isArray(todaysGames)) return null;
    const game = todaysGames.find(g => g.status === 'live' && (g.homeTeamCode === team.abbr || g.awayTeamCode === team.abbr));
    return game ? teamRowHref('nhl', game, team.abbr, primary.abbr, abbr => !!getTeamByAbbr(abbr)) : null;
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        className={TRIGGER_CLASSES}
        onClick={() => (open ? closeSheet() : openSheet())}
        aria-label={t('teamSwitcher.label', { team: primaryName })}
        aria-expanded={open}
        title={t('teamSwitcher.title')}
      >
        <LeagueTeamLogo team={primary} size={24} />
        <span aria-hidden="true" className="text-[10px] leading-none">▾</span>
      </button>

      {open && (
        <Sheet className="team-switcher-panel" anchor={anchor} label={t('teamSwitcher.title')}>
          <div className={HEADER_ROW_CLASSES}>
            <span />
            <button className={`team-switcher-close ${CLOSE_CLASSES}`} onClick={closeSheet} aria-label={t('common.close')}>✕</button>
          </div>
          <h1 className={TITLE_CLASSES}>{t('teamSwitcher.title')}</h1>

          <div className={SECTIONS_CLASSES}>
            <Section footer={followed.some(team => watchHref(team)) ? t('teamSwitcher.noteWatch') : t('teamSwitcher.note')}>
              {followed.map(team => {
                const name = teamFor(team)?.displayName || team.abbr;
                if (sameTeam(team, primary)) {
                  return (
                    <div key={`${team.sport}:${team.abbr}`} className={`team-switcher-row ${ROW_CLASSES}`}>
                      <LeagueTeamLogo team={team} />
                      <span className={ROW_TEXT_CLASSES}>
                        <span className={ROW_TITLE_CLASSES}>{name}</span>
                        <span className={ROW_SUB_CLASSES}>{leagueLabel(team.sport)}</span>
                      </span>
                      <span className={HERE_CLASSES}>{t('teamSwitcher.current')}</span>
                    </div>
                  );
                }
                const busy = sameTeam(team, switching);
                const switchButton = (
                  <button
                    className={`team-switcher-row ${ROW_BUTTON_CLASSES}`}
                    onClick={() => handleSwitch(team)}
                    disabled={!!switching}
                  >
                    <LeagueTeamLogo team={team} />
                    <span className={ROW_TEXT_CLASSES}>
                      <span className={ROW_TITLE_CLASSES}>{name}</span>
                      <span className={ROW_SUB_CLASSES}>{busy ? t('teamSwitcher.switching') : leagueLabel(team.sport)}</span>
                    </span>
                    <span className={CHEVRON_CLASSES} aria-hidden="true">›</span>
                  </button>
                );
                const href = watchHref(team);
                if (!href) return <div key={`${team.sport}:${team.abbr}`}>{switchButton}</div>;
                return (
                  <div key={`${team.sport}:${team.abbr}`} className="flex items-center">
                    <div className="flex-1 min-w-0">{switchButton}</div>
                    <Link to={href} className={WATCH_CLASSES} onClick={closeSheet} aria-label={t('teamSwitcher.watchLabel', { team: name })}>
                      <span aria-hidden="true">▶</span>{t('teamSwitcher.watch')}
                    </Link>
                  </div>
                );
              })}
            </Section>

            <Section>
              <button className={`team-switcher-manage ${ROW_BUTTON_CLASSES}`} onClick={handleManage}>
                <span className={ICON_CLASSES} aria-hidden="true">＋</span>
                <span className={ROW_TEXT_CLASSES}>
                  <span className={ROW_TITLE_CLASSES}>{t('settings.manageTeams')}</span>
                  <span className={ROW_SUB_CLASSES}>{t('settings.manageTeamsSub')}</span>
                </span>
                <span className={CHEVRON_CLASSES} aria-hidden="true">›</span>
              </button>
            </Section>
          </div>
        </Sheet>
      )}
    </div>
  );
}
