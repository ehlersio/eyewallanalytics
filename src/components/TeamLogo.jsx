import { useState } from 'react';
import './TeamLogo.css';

// NHL logos are served from assets.nhle.com, proxied through /nhl-assets in dev.
// Two variants: dark (white logo, for dark backgrounds) and light (colored, for white bg).
// We always use 'dark' since our app has a dark theme.
//
// URL pattern:  /nhl-assets/logos/nhl/svg/{ABBR}_dark.svg
// e.g. CAR → /nhl-assets/logos/nhl/svg/CAR_dark.svg

function logoUrl(abbr) {
  if (!abbr) return null;
  return `/nhl-assets/logos/nhl/svg/${abbr.toUpperCase()}_dark.svg`;
}

// Fallback: two-letter initials in team color when logo fails to load
function Fallback({ abbr, size, color }) {
  const initials = abbr ? abbr.slice(0, 2) : '?';
  return (
    <span
      className="team-logo-fallback"
      style={{
        width:  size,
        height: size,
        fontSize: Math.round(size * 0.38),
        color: color || 'var(--text-muted)',
      }}
    >
      {initials}
    </span>
  );
}

/**
 * TeamLogo
 *
 * Props:
 *   abbr    — three-letter team abbreviation, e.g. "CAR"
 *   size    — px size (default 24)
 *   color   — team primary color string for fallback text (from TEAM_COLORS)
 *   className — extra class names
 */
export default function TeamLogo({ abbr, size = 24, color, className = '' }) {
  const [errored, setErrored] = useState(false);
  const src = logoUrl(abbr);

  if (!abbr || errored) {
    return <Fallback abbr={abbr} size={size} color={color} />;
  }

  return (
    <img
      src={src}
      alt={abbr}
      width={size}
      height={size}
      className={`team-logo ${className}`}
      onError={() => setErrored(true)}
      style={{ width: size, height: size }}
    />
  );
}
