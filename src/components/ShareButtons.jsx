// components/ShareButtons.jsx
//
// Reusable share button row for all EyeWall export cards.
// Renders: [📸 Save Image] [𝕏 Share to X] [📤 Share] (mobile only)
//
// Props:
//   onSave          — async fn, called on Save click
//   onShareX        — fn, called on X click
//   onNativeShare   — async fn, called on Share click
//   canNativeShare  — bool, if false the Share button is hidden on desktop
//   saving          — bool, disables Save button + shows spinner
//   sharing         — bool, disables Share button + shows spinner
//   className       — optional wrapper class

export default function ShareButtons({
  onSave,
  onShareX,
  onNativeShare,
  canNativeShare,
  saving   = false,
  sharing  = false,
  className = '',
}) {
  return (
    <div className={`share-buttons-row ${className}`}>
      {/* Save image */}
      <button
        className="share-btn share-btn--save"
        onClick={onSave}
        disabled={saving || sharing}
        aria-label="Save image"
      >
        {saving ? '⏳' : '📸'} {saving ? 'Saving…' : 'Save Image'}
      </button>

      {/* Share to X */}
      <button
        className="share-btn share-btn--x"
        onClick={onShareX}
        disabled={saving || sharing}
        aria-label="Share to X (Twitter)"
      >
        𝕏 Post to X
      </button>

      {/* Native share — always render but hidden on desktop via CSS when unsupported */}
      <button
        className={`share-btn share-btn--native ${!canNativeShare ? 'share-btn--hidden-desktop' : ''}`}
        onClick={onNativeShare}
        disabled={saving || sharing}
        aria-label="Share via device share sheet"
      >
        {sharing ? '⏳' : '📤'} {sharing ? 'Sharing…' : 'Share'}
      </button>
    </div>
  );
}
