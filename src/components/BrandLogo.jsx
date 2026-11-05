// components/BrandLogo.jsx
//
// The EyeWall logo on the app's themed background (the top bar's About
// button and its popup): the themed version (HolidayMark.jsx) on a holiday
// or in a season, as Settings allows (hooks/useDayTheme.js), else the plain
// EyeWallLogo. Same size either way, so the top bar doesn't shift.

import EyeWallLogo from './EyeWallLogo';
import HolidayMark from './HolidayMark';
import useDayTheme from '../hooks/useDayTheme';

export default function BrandLogo({ className = '', alt = 'EyeWall Analytics', width, height }) {
  const holiday = useDayTheme();
  if (holiday) return <HolidayMark holiday={holiday} size={width} className={className} alt={alt} />;
  return <EyeWallLogo className={className} alt={alt} width={width} height={height} />;
}
