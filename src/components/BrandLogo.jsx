// components/BrandLogo.jsx
//
// The EyeWall logo on the app's themed background (the top bar's About
// button and its popup): the holiday version (HolidayMark.jsx) on a holiday
// when holiday themes are on (hooks/useHoliday.js), else the plain
// EyeWallLogo. Same size either way, so the top bar doesn't shift.

import EyeWallLogo from './EyeWallLogo';
import HolidayMark from './HolidayMark';
import useHoliday from '../hooks/useHoliday';

export default function BrandLogo({ className = '', alt = 'EyeWall Analytics', width, height }) {
  const holiday = useHoliday();
  if (holiday) return <HolidayMark holiday={holiday} size={width} className={className} alt={alt} />;
  return <EyeWallLogo className={className} alt={alt} width={width} height={height} />;
}
