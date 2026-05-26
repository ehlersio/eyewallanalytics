import { NavLink } from 'react-router-dom';
import './BottomNav.css';

const TABS = [
  { to: '/',         icon: '⬡',  label: 'Shot Map'  },
  { to: '/schedule', icon: '📅', label: 'Schedule'  },
  { to: '/players',  icon: '👤', label: 'Players'   },
  { to: '/team',     icon: '📊', label: 'Team'      },
  { to: '/news',     icon: '📰', label: 'News'      },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map(tab => (
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
