// Single-opponent team picker for Team vs Team comparison (Session 86).
// Deliberately a plain <select> rather than a chip grid like TeamPicker.jsx
// -- that component is a full-screen "choose your team" onboarding flow;
// this is a small in-popup control choosing among up to 32 teams, where a
// native select is the least amount of new UI to build and is free
// keyboard/a11y support.
//
// Tailwind migration (Session 95, Phase 1) -- previously TeamOpponentPicker.css.
// The focus-visible ring isn't reproduced here: index.css's global
// `:focus-visible` rule already applies the identical outline to every
// focusable element site-wide (Tailwind's preflight is never imported, so
// that global rule stays in effect after migration).
import { useTranslation } from 'react-i18next';

const PICKER_CLASSES = 'bg-[var(--bg2)] border-[0.5px] border-[var(--border-2)] rounded-[var(--radius-sm)] py-1.5 px-2.5 font-[family-name:var(--font-body)] text-[13px] font-semibold text-[color:var(--text)] cursor-pointer ml-4 hover:bg-[var(--bg3)]';

export default function TeamOpponentPicker({ teams, value, onChange, excludeValue }) {
  const { t } = useTranslation();
  const options = teams.filter(team => team.value !== excludeValue);

  return (
    <select
      className={PICKER_CLASSES}
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
      aria-label={t('teamOpponentPicker.ariaLabel')}
    >
      <option value="">{t('teamOpponentPicker.placeholder')}</option>
      {options.map(team => (
        <option key={team.value} value={team.value}>{team.label}</option>
      ))}
    </select>
  );
}
