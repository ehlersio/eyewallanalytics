// scripts/brand/build-brand-assets.mjs
//
// Regenerates every rendering of the EyeWall faceoff-E mark from
// src/brand/rinkMark.js: iOS app icon (light, dark and tinted), iOS launch
// splash (light and dark), web favicons, PWA icons and the header logo SVGs.
// Rerun it after any change to the mark's geometry or colors:
//
//   node scripts/brand/build-brand-assets.mjs
//
// macOS only -- PNGs are rasterized by render-svg.swift via AppKit.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RINK_PALETTES, rinkMarkSvg } from '../../src/brand/rinkMark.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const pub = join(root, 'public');
const xcassets = join(root, 'ios/App/App/Assets.xcassets');
const work = mkdtempSync(join(tmpdir(), 'eyewall-brand-'));

function png(svg, out, px, { opaque = false } = {}) {
  const src = join(work, `${px}-${Math.random().toString(36).slice(2)}.svg`);
  writeFileSync(src, svg);
  const args = [join(here, 'render-svg.swift'), src, out, String(px)];
  if (opaque) args.push('opaque');
  execFileSync('swift', args, { stdio: 'inherit' });
  console.log(`  ${out.replace(root + '/', '')} (${px}px)`);
}

// ICO container holding PNG-encoded entries (supported by every current browser).
function ico(pngPaths, out) {
  const images = pngPaths.map(p => readFileSync(p));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const img of images) {
    const w = img.readUInt32BE(16);
    const e = Buffer.alloc(16);
    e.writeUInt8(w >= 256 ? 0 : w, 0);
    e.writeUInt8(w >= 256 ? 0 : w, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(img.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += img.length;
    entries.push(e);
  }
  writeFileSync(out, Buffer.concat([header, ...entries, ...images]));
  console.log(`  ${out.replace(root + '/', '')}`);
}

console.log('Header logo and share-canvas SVGs');
writeFileSync(join(pub, 'eyewall-logo.svg'), rinkMarkSvg({ mode: 'dark', sheet: false }));
writeFileSync(join(pub, 'eyewall-logo-light.svg'), rinkMarkSvg({ mode: 'light', sheet: false }));
png(rinkMarkSvg({ mode: 'dark', sheet: false }), join(pub, 'eyewall-logo.png'), 1024);
png(rinkMarkSvg({ mode: 'light', sheet: false }), join(pub, 'eyewall-logo-light.png'), 1024);

console.log('Web favicons and PWA icons');
// SVG favicon follows the browser's color scheme: Ice Rink in light, Night Rink in dark.
const L = RINK_PALETTES.light;
const D = RINK_PALETTES.dark;
writeFileSync(join(pub, 'favicon.svg'), rinkMarkSvg({
  palette: { sheet: 'var(--sheet)', red: 'var(--red)', ink: 'var(--ink)' },
}).replace('<rect', `<style>:root{--sheet:${L.sheet};--red:${L.red};--ink:${L.ink}}`
  + `@media (prefers-color-scheme:dark){:root{--sheet:${D.sheet};--red:${D.red};--ink:${D.ink}}}</style><rect`));
png(rinkMarkSvg({ mode: 'light' }), join(pub, 'favicon-32.png'), 32);
png(rinkMarkSvg({ mode: 'light' }), join(pub, 'favicon-64.png'), 64);
png(rinkMarkSvg({ mode: 'light' }), join(pub, 'favicon-192.png'), 192);
png(rinkMarkSvg({ mode: 'light' }), join(pub, 'favicon-512.png'), 512);
png(rinkMarkSvg({ mode: 'light', inset: 0.1 }), join(pub, 'favicon-512-solid.png'), 512, { opaque: true });
png(rinkMarkSvg({ mode: 'light' }), join(pub, 'apple-touch-icon.png'), 180, { opaque: true });
const ico16 = join(work, 'ico16.png');
const ico32 = join(work, 'ico32.png');
const ico48 = join(work, 'ico48.png');
png(rinkMarkSvg({ mode: 'light' }), ico16, 16);
png(rinkMarkSvg({ mode: 'light' }), ico32, 32);
png(rinkMarkSvg({ mode: 'light' }), ico48, 48);
ico([ico16, ico32, ico48], join(pub, 'favicon.ico'));

console.log('iOS app icon (any / dark / tinted)');
const iconDir = join(xcassets, 'AppIcon.appiconset');
png(rinkMarkSvg({ mode: 'light' }), join(iconDir, 'AppIcon-512@2x.png'), 1024, { opaque: true });
png(rinkMarkSvg({ mode: 'dark' }), join(iconDir, 'AppIcon-dark.png'), 1024, { opaque: true });
png(rinkMarkSvg({ palette: { sheet: '#000000', red: '#FFFFFF', ink: '#A6A6A6' } }),
  join(iconDir, 'AppIcon-tinted.png'), 1024, { opaque: true });

console.log('iOS launch splash (light / dark)');
const splashDir = join(xcassets, 'Splash.imageset');
// The storyboard aspect-fills this square, so a 0.39 inset leaves the mark
// about 190pt wide on a current iPhone.
png(rinkMarkSvg({ mode: 'light', inset: 0.39 }), join(splashDir, 'splash-light.png'), 2732, { opaque: true });
png(rinkMarkSvg({ mode: 'dark', inset: 0.39 }), join(splashDir, 'splash-dark.png'), 2732, { opaque: true });

rmSync(work, { recursive: true, force: true });
console.log('Done.');
