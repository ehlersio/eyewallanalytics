// shareCardTheme.js -- the look of every exported share card.
//
// Mirrors eyewall-pipeline's social_posts.py (the Instagram/Facebook cards)
// so a card saved from the app and one posted by the pipeline read as the
// same brand: same 1080x1350 canvas, palette, Barlow type and header/footer.
// If one side changes, change the other -- social_posts.py's BG0/BG2/BG3/
// RED/RED_BRIGHT/GREEN/TEXT/MUTED and new_card() are the counterparts.
//
// Cards are dark-only regardless of the app theme, so these are literal
// colors rather than the app's theme-reactive CSS variables.

export const SHARE_W = 1080;
export const SHARE_H = 1350; // 4:5 portrait, Instagram's tallest feed ratio

export const SHARE = {
  bg0: '#080c14',
  bg2: '#101827',
  bg3: '#172035',
  red: '#cc2200',
  redBright: '#ff4422',
  green: '#3dba7e',
  text: '#e4e8f0',
  muted: '#8a99aa',
};

// Font families registered by index.css's @font-face block (the page lays
// the card out with them) and embedded into the exported image by
// useShareCard (html-to-image can't reach page fonts from its SVG).
export const SHARE_FONTS = [
  { family: 'EW Share Display', file: '/fonts/share/BarlowCondensed-ExtraBold.ttf', weight: 800 },
  { family: 'EW Share Label', file: '/fonts/share/BarlowCondensed-Bold.ttf', weight: 700 },
  { family: 'EW Share Body', file: '/fonts/share/Barlow-SemiBold.ttf', weight: 600 },
];
export const FONT_DISPLAY = "'EW Share Display', 'Barlow Condensed', sans-serif";
export const FONT_LABEL = "'EW Share Label', 'Barlow Condensed', sans-serif";
export const FONT_BODY = "'EW Share Body', 'Barlow', sans-serif";
