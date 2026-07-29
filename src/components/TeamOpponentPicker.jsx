// Single-opponent team picker for Team vs Team comparison (Session 86).
// Deliberately a plain <select> rather than a chip grid like TeamPicker.jsx
// -- that component is a full-screen "choose your team" onboarding flow;
// this is a small in-popup control choosing among up to 32 teams, where a
// native select is the least amount of new UI to build and is free
// keyboard/a11y support.
import './TeamOpponentPicker.css';

export default function TeamOpponentPicker({ teams, value, onChange, excludeValue }) {
  const options = teams.filter(t => t.value !== excludeValue);

  return (
    <select
      className="team-opponent-picker"
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
      aria-label="Choose opponent team"
    >
      <option value="">Choose opponent…</option>
      {options.map(t => (
        <option key={t.value} value={t.value}>{t.label}</option>
      ))}
    </select>
  );
}
