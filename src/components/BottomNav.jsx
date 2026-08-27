import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSport } from '../utils/SportContext';
import { useReadState } from '../hooks/useReadState';

const NEWS_PATHS = ['/news', '/pwhl/news'];

// labelKey looks up nav.* in i18n/locales/*.json -- tab labels are
// translated, routes/icons are not.
const NHL_TABS = [
  { to: '/',         icon: '⬡',  labelKey: 'nav.shotMap'  },
  { to: '/schedule', icon: '📅', labelKey: 'nav.schedule' },
  { to: '/players',  icon: '👤', labelKey: 'nav.players'  },
  { to: '/team',     icon: '📊', labelKey: 'nav.team'     },
  { to: '/league',   icon: '🏒', labelKey: 'nav.league'   },
  { to: '/news',     icon: '📰', labelKey: 'nav.news'     },
];

const PWHL_TABS = [
  { to: '/pwhl/shots',    icon: '⬡',  labelKey: 'nav.shotMap'  },
  { to: '/pwhl/schedule', icon: '📅', labelKey: 'nav.schedule' },
  { to: '/pwhl/players',  icon: '👤', labelKey: 'nav.players'  },
  { to: '/pwhl/team',     icon: '📊', labelKey: 'nav.team'     },
  { to: '/pwhl/league',   icon: '🏒', labelKey: 'nav.league'   },
  { to: '/pwhl/news',     icon: '📰', labelKey: 'nav.news'     },
];

// Tailwind migration (Phase 7c, final file of the migration) -- previously
// BottomNav.css. .bottom-nav's fixed positioning/z-index/height calc are
// unchanged byte-for-byte from the original CSS -- see the comment on
// BOTTOM_NAV_CLASSES below for why the height calc can never become a
// static utility. .nav-tab/.active/.nav-icon/.nav-badge-dot/.nav-label all
// kept as literal marker classNames -- Cypress depends on 3 of them
// directly (league.cy.js's `.nav-tab`/`.should('have.class', 'active')`,
// read-state-badges.cy.js's `.nav-badge-dot`), and .bottom-nav itself is
// the subject of player-comparison.cy.js's z-index/hit-testing regression
// test (asserting popup tab clicks do NOT land on the nav underneath).

// Pinned directly to the viewport edge (Session 43) -- previously this was
// a plain flex-shrink:0 child of .app-shell, relying entirely on the
// shell's height:100dvh calc staying in sync with the real viewport. After
// a hard reload (the only way to switch sport -- see SportContext.jsx's
// setSportAndReload/NotificationBell's handleChangeTeam), that calc could
// end up taller than the actual visible viewport on Android/Chrome,
// silently pushing this nav below the fold with no positioning of its own
// to fall back on. Fixed position removes that dependency entirely -- this
// always sits at the real screen bottom. env(safe-area-inset-*) keeps it
// clear of rounded-corner/gesture-bar areas (requires viewport-fit=cover in
// index.html's viewport meta tag).
//
// height/padding-bottom both reference --nav-height/env(safe-area-inset-
// bottom,0px) via calc() -- this MUST stay real CSS referencing the custom
// property, never a static utility, and must stay numerically in sync with
// App.jsx's .app-main padding-bottom and index.css's .page height calc
// (both already migrated, both already depending on this exact value).
// Written with the identical no-space calc()/env() syntax already
// established and merged in those two conversions (Phase 7b).
const BOTTOM_NAV_CLASSES = 'bottom-nav fixed bottom-0 left-0 right-0 z-[100] h-[calc(var(--nav-height)+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] bg-[var(--bg1)] border-t-[0.5px] border-t-[color:var(--border-2)] flex items-stretch';

// .nav-tab base + .active/:hover -- base carries NO color (lesson #9 shape):
// .active supplies its own complete color (red-bright) + the top indicator
// bar pseudo-element, inactive supplies text-dim + hover:text-muted. This
// preserves the original CSS's resolved behavior exactly: .nav-tab.active
// and .nav-tab:hover have equal specificity, and source order (.active
// defined after :hover) made .active win on a simultaneous hover+active --
// achieved here simply by never attaching a hover class to the active
// branch, rather than by replicating specificity/order.
const NAV_TAB_BASE = 'flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors duration-150 relative';
function navTabClasses(isActive) {
  return isActive
    ? `nav-tab active ${NAV_TAB_BASE} text-[color:var(--red-bright)] before:content-[''] before:absolute before:top-0 before:left-[20%] before:right-[20%] before:h-[2px] before:bg-[var(--red)] before:rounded-[0_0_3px_3px]`
    : `nav-tab ${NAV_TAB_BASE} text-[color:var(--text-dim)] hover:text-[color:var(--text-muted)]`;
}

const NAV_ICON_CLASSES = 'nav-icon relative inline-block text-[18px] leading-[1]';
const NAV_BADGE_DOT_CLASSES = 'nav-badge-dot absolute top-[-2px] right-[-4px] w-[7px] h-[7px] rounded-full bg-[var(--red-bright)] border-[1.5px] border-[color:var(--bg1)]';
const NAV_LABEL_CLASSES = 'nav-label text-[10px] font-medium tracking-[0.04em]';

export default function BottomNav() {
  const { t } = useTranslation();
  const { isPWHL } = useSport();
  const tabs = isPWHL ? PWHL_TABS : NHL_TABS;
  // Combined dot on the News icon — OR across News/Milestones/Trivia's own
  // per-tab unseen state (already computed by useReadState; no separate
  // tracking mechanism). Safe to mount alongside NewsView's own instance
  // of this hook — same localStorage keys, cross-instance reactivity via
  // the 'eyewall:read-state-updated' event (see useReadState.js).
  const readState = useReadState();

  return (
    <nav className={BOTTOM_NAV_CLASSES} aria-label={t('nav.mainNavigationAriaLabel')}>
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) => navTabClasses(isActive)}
        >
          <span className={NAV_ICON_CLASSES}>
            {tab.icon}
            {NEWS_PATHS.includes(tab.to) && readState.any && <span className={NAV_BADGE_DOT_CLASSES} />}
          </span>
          <span className={NAV_LABEL_CLASSES}>{t(tab.labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
