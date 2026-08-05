import { NavLink } from 'react-router-dom';
import { useSport } from '../utils/SportContext';
import { useReadState } from '../hooks/useReadState';
import './BottomNav.css';

const NEWS_PATHS = ['/news', '/pwhl/news'];

const NHL_TABS = [
  { to: '/',         icon: '⬡',  label: 'Shot Map' },
  { to: '/schedule', icon: '📅', label: 'Schedule' },
  { to: '/players',  icon: '👤', label: 'Players'  },
  { to: '/team',     icon: '📊', label: 'Team'     },
  { to: '/league',   icon: '🏒', label: 'League'   },
  { to: '/news',     icon: '📰', label: 'News'     },
];

const PWHL_TABS = [
  { to: '/pwhl/shots',    icon: '⬡',  label: 'Shot Map' },
  { to: '/pwhl/schedule', icon: '📅', label: 'Schedule' },
  { to: '/pwhl/players',  icon: '👤', label: 'Players'  },
  { to: '/pwhl/team',     icon: '📊', label: 'Team'     },
  { to: '/pwhl/league',   icon: '🏒', label: 'League'   },
  { to: '/pwhl/news',     icon: '📰', label: 'News'     },
];

export default function BottomNav() {
  const { isPWHL } = useSport();
  const tabs = isPWHL ? PWHL_TABS : NHL_TABS;
  // Combined dot on the News icon — OR across News/Milestones/Trivia's own
  // per-tab unseen state (already computed by useReadState; no separate
  // tracking mechanism). Safe to mount alongside NewsView's own instance
  // of this hook — same localStorage keys, cross-instance reactivity via
  // the 'eyewall:read-state-updated' event (see useReadState.js).
  const readState = useReadState();

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">
            {tab.icon}
            {NEWS_PATHS.includes(tab.to) && readState.any && <span className="nav-badge-dot" />}
          </span>
          <span className="nav-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
