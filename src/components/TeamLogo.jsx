import { useState } from 'react';
import { pwhlLogoUrl } from '../utils/pwhlConfig';
import { ahlLogoUrl, getAHLTeamConfig } from '../utils/ahlConfig';

// Tailwind migration (Session 95, Phase 1) -- previously TeamLogo.css.
const LOGO_CLASSES = 'inline-block object-contain shrink-0 align-middle drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]';
const FALLBACK_CLASSES = 'inline-flex items-center justify-center shrink-0 align-middle font-[family-name:var(--font-display)] font-bold tracking-[0.04em]';

// NHL logos are served from assets.nhle.com, proxied through /nhl-assets in dev.
// Two variants: dark (white logo, for dark backgrounds) and light (colored, for white bg).
// We always use 'dark' since our app has a dark theme.
//
// URL pattern:  /nhl-assets/logos/nhl/svg/{ABBR}_dark.svg
// e.g. CAR → /nhl-assets/logos/nhl/svg/CAR_dark.svg
//
// PWHL logos are self-hosted in public/pwhl-logos/.
// Filenames are irregular (see pwhlConfig.js PWHL_LOGO_FILES).
// sport prop: 'nhl' (default) | 'pwhl'

function nhlLogoUrl(abbr) {
  if (!abbr) return null;
  return `/nhl-assets/logos/nhl/svg/${abbr.toUpperCase()}_dark.svg`;
}

// Fallback: two-letter initials in team color when logo fails to load
function Fallback({ abbr, size, color }) {
  const initials = abbr ? abbr.slice(0, 2) : '?';
  return (
    <span
      className={FALLBACK_CLASSES}
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
 *   abbr    — team abbreviation, e.g. "CAR" (NHL), "BOS" (PWHL), "TOR" (AHL)
 *   sport   — 'nhl' (default) | 'pwhl' | 'ahl'
 *   size    — px size (default 24)
 *   color   — team primary color string for fallback text
 *   className — extra class names
 */
export default function TeamLogo({ abbr, sport = 'nhl', size = 24, color, className = '' }) {
  const [errored, setErrored] = useState(false);

  // AHL logos are hosted by HockeyTech's numeric team_id, not abbr (see
  // ahlConfig.js's ahlLogoUrl docstring) -- resolve abbr -> teamId here
  // rather than changing this component's abbr-keyed prop shape.
  const src =
    sport === 'pwhl' ? pwhlLogoUrl(abbr)
    : sport === 'ahl' ? ahlLogoUrl(getAHLTeamConfig(abbr)?.teamId)
    : nhlLogoUrl(abbr);

  if (!abbr || !src || errored) {
    return <Fallback abbr={abbr} size={size} color={color} />;
  }

  return (
    <img
      src={src}
      alt={abbr}
      width={size}
      height={size}
      className={`${LOGO_CLASSES} ${className}`}
      onError={() => setErrored(true)}
      style={{ width: size, height: size }}
    />
  );
}
