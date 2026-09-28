// components/SettingsTeams.jsx -- Settings' teams (Settings redesign,
// Option A): the "Your teams" section on the main screen, the Your teams
// screen (primary, order, remove) and Add a team. The list itself is
// utils/followedTeams.js.
//
// Tapping a followed team that isn't primary makes it primary: the app
// reloads as that team, as a pick in TeamPicker does. Seeing another
// followed team without a reload is a later step.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TeamLogo from './TeamLogo';
import { ahlLogoUrl } from '../utils/ahlConfig';
import { echlLogoUrl } from '../utils/echlConfig';
import {
  LEAGUES, moved, sameTeam, saveFollowedTeams, switchPrimaryTeam, teamFor, withTeam, withoutTeam,
} from '../utils/followedTeams';
import {
  CHEVRON_CLASSES, ICON_CLASSES, ROW_BUTTON_CLASSES, ROW_CLASSES, ROW_SUB_CLASSES, ROW_TEXT_CLASSES,
  ROW_TITLE_CLASSES, Section, Segments,
} from './SheetParts';

const PRIMARY_TAG_CLASSES = 'settings-primary-tag text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--amber)] border border-[rgba(240,160,48,0.45)] rounded-[6px] py-0.5 px-1.5 whitespace-nowrap';
// Narrow but full height: 44px to tap, without squeezing the team name.
const ICON_BTN_BASE = 'h-11 flex items-center justify-center shrink-0 rounded-[10px] border-0 bg-transparent text-[18px] cursor-pointer hover:bg-[var(--btn-fill)] disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent';
const ICON_BTN_CLASSES = `${ICON_BTN_BASE} w-8 text-[color:var(--text-dim)] hover:text-[color:var(--text)]`;
const STAR_CLASSES = `${ICON_BTN_BASE} w-10 text-[20px]`;
const FOLLOW_BTN_CLASSES = 'settings-follow-btn min-h-[36px] px-3.5 rounded-[18px] border border-[var(--border-2)] bg-transparent text-[13px] font-semibold text-[color:var(--text)] cursor-pointer hover:bg-[var(--btn-fill)] whitespace-nowrap';
const FOLLOWING_CLASSES = 'text-[13px] font-semibold text-[color:var(--green)] whitespace-nowrap';
const NOTE_CLASSES = 'text-[13px] text-[color:var(--text-muted)] leading-[1.5] m-0 px-1';
const SEARCH_CLASSES = 'settings-team-search w-full min-h-[44px] box-border rounded-[12px] border-0 bg-[var(--bg3)] px-3.5 text-[16px] text-[color:var(--text)] placeholder:text-[color:var(--text-dim)] outline-none focus:ring-2 focus:ring-[var(--team-primary)]';

const leagueLabel = sport => LEAGUES.find(l => l.sport === sport)?.label || sport.toUpperCase();

// NHL and PWHL logos are local assets (TeamLogo); AHL and ECHL come from
// their leagues' own logo CDNs, as TeamPicker shows them.
export function LeagueTeamLogo({ team: { sport, abbr }, size = 32 }) {
  const t = teamFor({ sport, abbr });
  if (sport === 'ahl' && t) return <img src={ahlLogoUrl(t.teamId)} alt="" width={size} height={size} className="object-contain shrink-0" />;
  if (sport === 'echl' && t) return <img src={echlLogoUrl(t.teamId)} alt="" width={size} height={size} className="object-contain shrink-0" />;
  return <TeamLogo abbr={abbr} size={size} sport={sport} />;
}

function TeamText({ team, sub }) {
  const t = teamFor(team);
  return (
    <span className={ROW_TEXT_CLASSES}>
      <span className={ROW_TITLE_CLASSES}>{t?.displayName || team.abbr}</span>
      <span className={ROW_SUB_CLASSES}>{sub ?? leagueLabel(team.sport)}</span>
    </span>
  );
}

// Main screen: every followed team, the primary marked; tap another to
// switch to it. Then "Manage teams".
export function TeamsSection({ followed, primary, userId, onManage }) {
  const { t } = useTranslation();
  return (
    <Section label={t('settings.yourTeams')}>
      {followed.map(team => (sameTeam(team, primary) ? (
        <div key={`${team.sport}:${team.abbr}`} className={`settings-team-row ${ROW_CLASSES}`}>
          <LeagueTeamLogo team={team} />
          <TeamText team={team} />
          <span className={PRIMARY_TAG_CLASSES}>{t('settings.primary')}</span>
        </div>
      ) : (
        <button
          key={`${team.sport}:${team.abbr}`}
          className={`settings-team-row settings-team-switch ${ROW_BUTTON_CLASSES}`}
          onClick={() => switchPrimaryTeam(team, userId)}
        >
          <LeagueTeamLogo team={team} />
          <TeamText team={team} sub={t('settings.switchToTeam', { league: leagueLabel(team.sport) })} />
          <span className={CHEVRON_CLASSES} aria-hidden="true">›</span>
        </button>
      )))}
      <button className={`settings-manage-teams ${ROW_BUTTON_CLASSES}`} onClick={onManage}>
        <span className={ICON_CLASSES} aria-hidden="true">＋</span>
        <span className={ROW_TEXT_CLASSES}>
          <span className={ROW_TITLE_CLASSES}>{t('settings.manageTeams')}</span>
          <span className={ROW_SUB_CLASSES}>{t('settings.manageTeamsSub')}</span>
        </span>
        <span className={CHEVRON_CLASSES} aria-hidden="true">›</span>
      </button>
    </Section>
  );
}

// Your teams: star to make primary, move up/down, remove; Add a team.
export function TeamsScreen({ followed, primary, userId, onAdd }) {
  const { t } = useTranslation();
  const save = list => saveFollowedTeams(list, userId);
  return (
    <>
      <Section footer={t('settings.primaryNote')}>
        {followed.map((team, i) => {
          const isPrimary = sameTeam(team, primary);
          const name = teamFor(team)?.displayName || team.abbr;
          return (
            <div key={`${team.sport}:${team.abbr}`} className={`settings-manage-row ${ROW_CLASSES} gap-1 pl-1 pr-1.5`}>
              <button
                className={`settings-make-primary ${STAR_CLASSES} ${isPrimary ? 'text-[color:var(--amber)]' : 'text-[color:var(--text-dim)] hover:text-[color:var(--amber)]'}`}
                onClick={() => !isPrimary && switchPrimaryTeam(team, userId)}
                aria-pressed={isPrimary}
                aria-label={isPrimary ? t('settings.isPrimary', { team: name }) : t('settings.makePrimary', { team: name })}
              >
                {isPrimary ? '★' : '☆'}
              </button>
              <LeagueTeamLogo team={team} />
              <TeamText team={team} sub={isPrimary ? `${leagueLabel(team.sport)} · ${t('settings.primary')}` : undefined} />
              <button className={`settings-move-up ${ICON_BTN_CLASSES}`} disabled={i === 0}
                onClick={() => save(moved(followed, i, -1))} aria-label={t('settings.moveUp', { team: name })}>↑</button>
              <button className={`settings-move-down ${ICON_BTN_CLASSES}`} disabled={i === followed.length - 1}
                onClick={() => save(moved(followed, i, 1))} aria-label={t('settings.moveDown', { team: name })}>↓</button>
              {/* The primary can't be removed -- star another team first. */}
              <button className={`settings-unfollow ${ICON_BTN_CLASSES}`} disabled={isPrimary}
                onClick={() => save(withoutTeam(followed, team, primary))} aria-label={t('settings.unfollow', { team: name })}>✕</button>
            </div>
          );
        })}
      </Section>
      <Section>
        <button className={`settings-add-team ${ROW_BUTTON_CLASSES}`} onClick={onAdd}>
          <span className={ICON_CLASSES} aria-hidden="true">＋</span>
          <span className={ROW_TEXT_CLASSES}><span className={ROW_TITLE_CLASSES}>{t('settings.addTeam')}</span></span>
          <span className={CHEVRON_CLASSES} aria-hidden="true">›</span>
        </button>
      </Section>
    </>
  );
}

// Add a team: a league at a time, or search across all four.
export function AddTeamScreen({ followed, primary, userId }) {
  const { t } = useTranslation();
  const [sport, setSport] = useState(primary?.sport || 'nhl');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const teams = useMemo(() => {
    const pool = q ? LEAGUES : LEAGUES.filter(l => l.sport === sport);
    return pool.flatMap(l => l.teams
      .filter(team => !q || team.displayName.toLowerCase().includes(q) || team.abbr.toLowerCase() === q)
      .map(team => ({ sport: l.sport, abbr: team.abbr, name: team.displayName })))
      .sort((a, b) => (q ? a.name.localeCompare(b.name) : 0));
  }, [q, sport]);

  return (
    <>
      <input
        className={SEARCH_CLASSES}
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={t('settings.searchTeams')}
        aria-label={t('settings.searchTeams')}
      />
      {!q && (
        <Segments
          label={t('settings.league')}
          value={sport}
          onChange={setSport}
          options={LEAGUES.map(l => ({ value: l.sport, label: l.label, className: `settings-league-${l.sport}` }))}
        />
      )}
      {teams.length ? (
        <Section footer={t('settings.addTeamNote')}>
          {teams.map(team => {
            const isPrimary = sameTeam(team, primary);
            const isFollowed = followed.some(f => sameTeam(f, team));
            return (
              <div key={`${team.sport}:${team.abbr}`} className={`settings-add-row ${ROW_CLASSES}`}>
                <LeagueTeamLogo team={team} />
                <TeamText team={team} />
                {isPrimary ? <span className={PRIMARY_TAG_CLASSES}>{t('settings.primary')}</span>
                  : isFollowed ? <span className={FOLLOWING_CLASSES}>✓ {t('settings.following')}</span>
                    : (
                      <button className={FOLLOW_BTN_CLASSES} onClick={() => saveFollowedTeams(withTeam(followed, team), userId)}
                        aria-label={t('settings.followTeam', { team: team.name })}>
                        ＋ {t('settings.follow')}
                      </button>
                    )}
              </div>
            );
          })}
        </Section>
      ) : (
        <p className={NOTE_CLASSES}>{t('settings.noTeamsFound', { query })}</p>
      )}
    </>
  );
}
