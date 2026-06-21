import { NavLink } from 'react-router-dom';
import { useSport } from '../utils/SportContext';
import './BottomNav.css';

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

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
