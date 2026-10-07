// components/WinProbChip.jsx
// The Elo win-probability chip on a PWHL/AHL/ECHL schedule card -- the
// same chip, classes and wording as the NHL GameCard's (`gc-favoured-chip`):
// the followed team's win % when it's the more likely winner, otherwise the
// opponent's. The number is the Worker's schedule-row `winProb`
// ({ home, away, source: 'elo' }, from {league}_game_win_probs, written the
// morning of each game by the pipeline's hockeytech_elo.py); a row without
// one shows no chip. Plain probability -- no betting framing.
import { useTranslation } from 'react-i18next';

// { favoured, pct, abbr } for the chip, or null without a usable winProb.
// `pct` is the shown side's win %, rounded, as the NHL chip shows it.
export function winProbChipData(winProb, isHome, abbr, oppAbbr) {
  const home = winProb?.home, away = winProb?.away;
  if (typeof home !== 'number' || typeof away !== 'number') return null;
  const mine = Math.round((isHome ? home : away) * 100);
  return mine >= 50
    ? { favoured: true, pct: mine, abbr }
    : { favoured: false, pct: 100 - mine, abbr: oppAbbr };
}

export default function WinProbChip({ winProb, isHome, abbr, oppAbbr }) {
  const { t } = useTranslation();
  const chip = winProbChipData(winProb, isHome, abbr, oppAbbr);
  if (!chip) return null;
  return (
    <span
      data-testid="win-prob-chip"
      title={t('winProbChip.title', { team: chip.abbr, pct: chip.pct })}
      className={`gc-favoured-chip text-[10px] font-bold py-[2px] px-2 rounded-[10px] ${chip.favoured ? 'fav bg-[rgba(61,186,126,0.15)] text-[color:var(--green)]' : 'dog bg-[rgba(204,34,0,0.12)] text-[color:var(--red-bright)]'}`}
    >
      {chip.favoured ? `✓ ${chip.abbr} ${chip.pct}%` : `⚠ ${chip.abbr} ${chip.pct}%`}
    </span>
  );
}
