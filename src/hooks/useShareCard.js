// hooks/useShareCard.js
//
// Shared hook behind the single Share button on every EyeWall export card.
//
// Usage:
//   const { saving, sharing, handleNativeShare } =
//     useShareCard({ canvasRef, filename, xCaption, mountCanvas });
//
// handleNativeShare — calls navigator.share() with image blob (mobile OS share
//                     sheet); falls back to a PNG download when the Web Share
//                     API isn't available (setting `saving`, not `sharing`,
//                     while it does) — pass both booleans to ShareButtons so
//                     it stays disabled/spinning through either path.

import { useState, useCallback } from 'react';
import { SHARE_FONTS, SHARE_W, SHARE_H } from '../utils/shareCardTheme';

// The card's Barlow faces as inline @font-face rules. html-to-image renders
// through an SVG <foreignObject>, which can't see the page's fonts, so the
// files are embedded as data URLs. Built once per session, only on the
// first share -- nobody downloads them just for opening the app.
let fontEmbedCSSPromise = null;
function shareFontEmbedCSS() {
  if (!fontEmbedCSSPromise) {
    fontEmbedCSSPromise = Promise.all(SHARE_FONTS.map(async ({ family, file, weight }) => {
      const blob = await (await fetch(file)).blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new globalThis.FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return `@font-face{font-family:'${family}';src:url(${dataUrl}) format('truetype');font-weight:${weight};}`;
    })).then(rules => rules.join('\n'))
      .catch(e => { fontEmbedCSSPromise = null; throw e; });
  }
  return fontEmbedCSSPromise;
}

export async function renderToPng(node) {
  const { toPng } = await import('html-to-image');
  // Lay the card out with the real fonts before measuring/capturing it.
  if (document.fonts?.load) {
    await Promise.all(SHARE_FONTS.map(f => document.fonts.load(`${f.weight} 32px '${f.family}'`))).catch(() => {});
  }
  // A font fetch failure still exports the card, just in the fallback font.
  const fontEmbedCSS = await shareFontEmbedCSS().catch(() => '');
  return toPng(node, {
    width:  SHARE_W,
    height: SHARE_H,
    fontEmbedCSS,
    imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    style: { position: 'static', left: '0', top: '0' },
  });
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

// True if the browser supports sharing files via Web Share API
const canNativeShare =
  typeof navigator !== 'undefined' &&
  typeof navigator.share === 'function' &&
  typeof navigator.canShare === 'function';

export function useShareCard({ canvasRef, filename, xCaption, mountCanvas, getNode: getNodeOverride }) {
  const [saving,  setSaving]  = useState(false);
  const [sharing, setSharing] = useState(false);

  // Ensure canvas is mounted (lazy) and return the node
  const getNode = useCallback(async () => {
    if (mountCanvas) await mountCanvas();
    // Small delay so React renders the canvas before html-to-image captures it
    await new Promise(r => setTimeout(r, 120));
    if (getNodeOverride) return getNodeOverride();
    return canvasRef?.current || document.getElementById('pr-export-canvas') || null;
  }, [canvasRef, mountCanvas, getNodeOverride]);

  // ── Save image (download) ────────────────────────────────────
  const handleSave = useCallback(async (onSuccess) => {
    setSaving(true);
    try {
      const node = await getNode();
      if (!node) return;
      const dataUrl = await renderToPng(node);
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
      onSuccess?.('save');
    } catch (e) {
      console.error('[useShareCard] Save failed:', e);
    } finally {
      setSaving(false);
    }
  }, [getNode, filename]);

  // ── Native share (OS share sheet — Instagram, WhatsApp, etc.) ─
  const handleNativeShare = useCallback(async (onSuccess) => {
    // Fall back to save if Web Share API not available
    if (!canNativeShare) {
      return handleSave(onSuccess);
    }
    setSharing(true);
    try {
      const node = await getNode();
      if (!node) return;
      const dataUrl = await renderToPng(node);
      const blob    = await dataUrlToBlob(dataUrl);
      const file    = new globalThis.File([blob], filename.replace('.png', '') + '.png', { type: 'image/png' });

      if (!navigator.canShare({ files: [file] })) {
        // Files not supported — fall back to text share
        await navigator.share({ title: 'EyeWall Analytics', text: xCaption, url: 'https://eyewallanalytics.com' });
        onSuccess?.('share');
        return;
      }

      await navigator.share({
        title: 'EyeWall Analytics',
        text:  xCaption,
        files: [file],
      });
      onSuccess?.('share');
    } catch (e) {
      if (e?.name !== 'AbortError') {
        console.error('[useShareCard] Native share failed:', e);
        // Last resort — save
        handleSave(onSuccess);
      }
    } finally {
      setSharing(false);
    }
  }, [getNode, filename, xCaption, handleSave]);

  return {
    saving,
    sharing,
    handleNativeShare,
  };
}
