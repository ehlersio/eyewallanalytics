// ShareCardFrame.jsx -- the shell every exported share card is drawn in.
//
// Same layout as eyewall-pipeline's social_posts.py new_card(): red top
// bar, logo + wordmark with a kicker on the right, a big title and a
// subtitle, the card's own content, then a footer with the site and a
// short note. EyeWall red is the frame; the card's team color (`accent`)
// is exposed to the content as --team-canvas for team-specific accents.
//
// Rendered off-screen at 1080x1350 and captured by useShareCard.

import { useTranslation } from 'react-i18next';
import { SHARE, SHARE_W, SHARE_H, FONT_DISPLAY, FONT_LABEL, FONT_BODY } from '../utils/shareCardTheme';

const PAD = 64;

// Barlow Condensed ExtraBold averages ~0.47em per character; shrink long
// titles to fit the 952px content width instead of clipping them.
export function fitTitleSize(text, max = 92, width = SHARE_W - PAD * 2) {
  const len = String(text ?? '').length || 1;
  return Math.max(48, Math.min(max, Math.floor(width / (len * 0.47))));
}

export default function ShareCardFrame({
  canvasRef, id, kicker, title, subtitle, note, accent = SHARE.redBright, children,
}) {
  return (
    <div
      ref={canvasRef}
      id={id}
      className="share-card-canvas"
      style={{
        position: 'fixed', left: -9999, top: 0, zIndex: -1, pointerEvents: 'none',
        width: SHARE_W, height: SHARE_H, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        background: SHARE.bg0, color: SHARE.text, fontFamily: FONT_BODY,
        '--team-canvas': accent,
      }}
    >
      <div style={{ height: 10, background: SHARE.red, flexShrink: 0 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: `42px ${PAD}px 0`, flexShrink: 0 }}>
        <img src="/eyewall-logo.svg" alt="" style={{ width: 64, height: 64, objectFit: 'contain' }}
          onError={e => { e.target.style.display = 'none'; }} />
        <span style={{ fontFamily: FONT_LABEL, fontSize: 30, letterSpacing: '0.02em', color: SHARE.text }}>
          EYEWALL ANALYTICS
        </span>
        {kicker && (
          <span style={{ marginLeft: 'auto', fontFamily: FONT_LABEL, fontSize: 28, color: SHARE.redBright, textTransform: 'uppercase' }}>
            {kicker}
          </span>
        )}
      </div>

      <div style={{ padding: `30px ${PAD}px 0`, flexShrink: 0 }}>
        <div style={{
          fontFamily: FONT_DISPLAY, fontSize: fitTitleSize(title), lineHeight: 1.05,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 30, color: SHARE.muted, marginTop: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitle}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: `30px ${PAD}px 20px`, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {children}
      </div>

      <div style={{
        margin: `0 ${PAD}px`, height: 96, flexShrink: 0, borderTop: `2px solid ${SHARE.bg3}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
      }}>
        <span style={{ fontFamily: FONT_LABEL, fontSize: 30 }}>eyewallanalytics.com</span>
        {note && <span style={{ fontSize: 24, color: SHARE.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</span>}
      </div>
    </div>
  );
}

// ── Content building blocks ──────────────────────────────────────────

export function ShareSection({ label, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontFamily: FONT_LABEL, fontSize: 28, color: SHARE.redBright, textTransform: 'uppercase', marginBottom: 12 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// Rounded row with a colored left edge -- social_posts.py's row_box().
export function ShareRow({ accent = SHARE.bg3, children, style }) {
  return (
    <div style={{
      position: 'relative', background: SHARE.bg2, borderRadius: 12, overflow: 'hidden',
      padding: '14px 24px 14px 32px', display: 'flex', alignItems: 'center', gap: 16, ...style,
    }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, background: accent }} />
      {children}
    </div>
  );
}

// "⚡ EyeWall AI" block, clamped so a long narrative can't push the rest
// of the card out of the frame.
export function ShareAiBlock({ text, lines = 5, style }) {
  const { t } = useTranslation();
  if (!text) return null;
  return (
    <div style={{ background: SHARE.bg2, borderRadius: 12, padding: '18px 24px', borderLeft: '6px solid var(--team-canvas)', ...style }}>
      <div style={{ fontFamily: FONT_LABEL, fontSize: 24, color: 'var(--team-canvas)', marginBottom: 8 }}>
        {t('gameStatsPopup.summary.badge')}
      </div>
      <div style={{
        fontSize: 25, lineHeight: 1.45, color: 'rgba(228,232,240,0.88)',
        display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {text}
      </div>
    </div>
  );
}

// Head-to-head stat: left value, centered label, right value. `better`
// ('left' | 'right' | null) brightens the winning side.
export function ShareCompareRow({ label, left, right, better, leftColor, rightColor, compact = false }) {
  const dim = 'rgba(228,232,240,0.45)';
  const side = (val, isBetter, color, align) => (
    <span style={{
      width: 190, textAlign: align, fontFamily: FONT_DISPLAY, fontSize: compact ? 34 : 40, lineHeight: 1,
      color: better == null ? (color || SHARE.text) : isBetter ? (color || SHARE.text) : dim,
    }}>
      {val}
    </span>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: compact ? '2px 0' : '4px 0' }}>
      {side(left, better === 'left', leftColor, 'right')}
      <span style={{ flex: 1, textAlign: 'center', fontFamily: FONT_LABEL, fontSize: 24, color: SHARE.muted, textTransform: 'uppercase' }}>
        {label}
      </span>
      {side(right, better === 'right', rightColor, 'left')}
    </div>
  );
}

// Two teams and a win-probability bar -- used by both prediction cards.
export function ShareMatchupHero({ left, right }) {
  const leftPct = Math.round(left.pct);
  const rightPct = 100 - leftPct;
  const team = ({ abbr, color, logo }, align) => (
    <div style={{ width: 150, display: 'flex', flexDirection: 'column', alignItems: align, gap: 8, flexShrink: 0 }}>
      <div style={{ height: 76, display: 'flex', alignItems: 'center' }}>{logo}</div>
      <span style={{ fontFamily: FONT_DISPLAY, fontSize: 44, lineHeight: 1, color }}>{abbr}</span>
    </div>
  );
  const seg = (pct, color) => (
    <div style={{ width: `${pct}%`, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {pct >= 18 && <span style={{ fontFamily: FONT_DISPLAY, fontSize: 36, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>{pct}%</span>}
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
      {team(left, 'flex-start')}
      <div style={{ flex: 1, display: 'flex', height: 64, borderRadius: 32, overflow: 'hidden', background: SHARE.bg3 }}>
        {seg(leftPct, left.color)}
        {seg(rightPct, right.color)}
      </div>
      {team(right, 'flex-end')}
    </div>
  );
}

// Big number tiles in a row (projected score, total, record...).
export function ShareTiles({ tiles }) {
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {tiles.map((tile, i) => (
        <div key={i} style={{ flex: tile.flex ?? 1, background: SHARE.bg2, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontFamily: FONT_LABEL, fontSize: 22, color: SHARE.muted, textTransform: 'uppercase', marginBottom: 6 }}>{tile.label}</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: tile.size ?? 56, lineHeight: 1 }}>{tile.value}</div>
        </div>
      ))}
    </div>
  );
}
