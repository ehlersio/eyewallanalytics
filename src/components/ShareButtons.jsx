// components/ShareButtons.jsx
import { useTranslation } from 'react-i18next';
//
// Single Share button for all EyeWall export cards. Opens the OS share sheet
// on mobile; useShareCard's handleNativeShare falls back to a PNG download
// wherever the Web Share API isn't available (desktop), so this component
// doesn't need to branch on device/browser support itself.
//
// Props:
//   onNativeShare — async fn, called on click
//   saving        — bool, true while the desktop-fallback download is running
//   sharing       — bool, true while the native OS share sheet is running
//                   (pass both — handleNativeShare's fallback path only
//                   toggles `saving`, not `sharing`)
//   className     — optional wrapper class
//
// Session 96 Tailwind migration -- previously ShareButtons.css, imported
// redundantly by all consumers even though this file itself never imported
// its own CSS -- those imports were removed as part of that migration.
//
// .share-buttons-row is kept as a literal marker string alongside the
// Tailwind utilities -- league.cy.js and period-summary.cy.js select on it
// directly. Carries no CSS of its own; Tailwind owns the visuals, this is a
// pure test hook now.
//
// Collapsed from a 3-button row (Save Image / Share to X / native Share) to
// this single button -- the other two were redundant with the OS share sheet
// (and its download fallback), and a lone button stretched to the 3-up row's
// full width read as an oversized button full of empty padding.
const ROW_CLASSES = 'share-buttons-row flex gap-2 flex-wrap items-center justify-center';
const BTN_CLASSES = 'inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-[12px] border-0 text-[13px] font-bold cursor-pointer [transition:opacity_0.15s,transform_0.1s] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] bg-[var(--red-bright)] text-[#fff] enabled:hover:opacity-[0.88]';

export default function ShareButtons({
  onNativeShare,
  saving   = false,
  sharing  = false,
  className = '',
}) {
  const { t } = useTranslation();
  const busy = saving || sharing;
  return (
    <div className={`${ROW_CLASSES} ${className}`}>
      <button
        className={BTN_CLASSES}
        onClick={onNativeShare}
        disabled={busy}
        aria-label={t('shareButtons.nativeShare.ariaLabel')}
      >
        {busy ? '⏳' : '📤'} {busy ? t('shareButtons.nativeShare.sharing') : t('shareButtons.nativeShare.share')}
      </button>
    </div>
  );
}
