import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getSavedUnits, defaultUnits, UNITS_CHANGED_EVENT } from '../utils/unitsConfig';

// 'imperial' | 'metric' -- the saved choice, else the language's default
// (see unitsConfig.js). Re-renders when either changes.
export function useUnits() {
  const { i18n } = useTranslation();
  const [saved, setSaved] = useState(getSavedUnits);
  useEffect(() => {
    const onChange = () => setSaved(getSavedUnits());
    window.addEventListener(UNITS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(UNITS_CHANGED_EVENT, onChange);
  }, []);
  return saved ?? defaultUnits(i18n.language);
}
