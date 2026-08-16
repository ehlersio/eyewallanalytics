// components/EyeWallLogo.jsx
//
// Theme-aware EyeWall wordmark (Session 100). /eyewall-logo.svg's bright
// white/silver colors only read well against the app's dark theme; on a
// light background they wash out even with the thin black outline baked
// into the mark. /eyewall-logo-light.svg is the same artwork with its
// low-saturation (white/gray) fills darkened -- same outline, same red
// accent, just enough contrast to hold up on light backgrounds too.
//
// Renders both images stacked and toggles visibility via CSS on the app's
// [data-theme] attribute (index.css) rather than a JS getTheme() check --
// matches this codebase's established theme-override convention (see
// index.css's [data-theme="light"] token blocks) and reacts instantly to
// a live theme toggle with no re-render needed, unlike a one-time JS read.
//
// Only use this where the logo sits on the app's own themed background
// (page background, topbar, popups). The share-canvas components
// (PeriodSummary.jsx, PredictionShareCanvas.jsx, ScoutingTab.jsx, etc.)
// render on a fixed dark canvas regardless of app theme -- they should
// keep using /eyewall-logo.svg directly, not this component.
export default function EyeWallLogo({ className = '', alt = 'EyeWall Analytics', width, height, onError }) {
  return (
    <>
      <img src="/eyewall-logo.svg" alt={alt} width={width} height={height}
        className={`eyewall-logo-dark ${className}`} onError={onError} />
      <img src="/eyewall-logo-light.svg" alt={alt} width={width} height={height}
        className={`eyewall-logo-light ${className}`} onError={onError} />
    </>
  );
}
