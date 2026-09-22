// src/components/RankBadge.jsx
// A team's league rank under an Overview stat tile ("5th", "21st", "1er"),
// shared by the NHL, PWHL, AHL and ECHL Team pages. Each page used to carry
// its own copy with a hand-rolled r === 1 ? 'st' : ... suffix -- English
// only, and wrong past 20 ("21th", "22th", "32th") -- and the AHL/ECHL
// copies had inherited the PWHL's 8-team colour cut-offs, so 7th of 32
// showed red.

import { useTranslation } from 'react-i18next'
import { ordinalSuffix } from '../utils/formatters'

const RANK_CLASSES = 'overview-stat-rank text-[10px] font-bold font-[family-name:var(--font-mono)] mt-[2px] block'
const SUP_CLASSES = 'text-[7px]'

// Colour tiers scale with the field. The ratio is the NHL's long-standing
// top 5 / top 15 of 32, so the NHL is unchanged and a 12-team PWHL gets
// exactly the 2 / 6 it always had.
export function rankTier(r, of) {
  const green = Math.max(1, Math.round((of * 5) / 32))
  const muted = Math.max(green, Math.round((of * 15) / 32))
  return r <= green ? 'good' : r <= muted ? 'mid' : 'bad'
}

const TIER_COLOR = { good: 'var(--green)', mid: 'var(--text-muted)', bad: 'var(--red-bright)' }

export default function RankBadge({ r, of }) {
  const { i18n } = useTranslation()
  if (!r || !of) return null
  return (
    <span className={RANK_CLASSES} style={{ color: TIER_COLOR[rankTier(r, of)] }}>
      {r}<sup className={SUP_CLASSES}>{ordinalSuffix(r, i18n.language)}</sup>
    </span>
  )
}
