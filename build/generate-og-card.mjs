// Generate the OG share card by rendering build/og-card.html in headless Chromium
// and screenshotting at exactly 1200x630.
//
// Usage:  node build/generate-og-card.mjs
// Output: images/og-cover.jpg  (and a .png copy for archival)
//
// To swap the hero image, edit the --hero CSS variable in build/og-card.html
// and re-run this script.

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..');
const CARD_HTML  = path.join(__dirname, 'og-card.html');
const OUT_JPG    = path.join(ROOT, 'images', 'og-cover.jpg');
const OUT_PNG    = path.join(ROOT, 'images', 'og-cover.png');

const W = 1200;
const H = 630;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1, // 1x = native 1200x630 (matches what OG renders at)
  });
  const page = await context.newPage();

  // file:// URL so relative ../images/... resolves correctly
  const url = 'file://' + CARD_HTML;
  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait for webfonts to fully load before snapshot
  await page.evaluate(() => document.fonts.ready);
  // Tiny extra settle so backdrop-filter and gradients commit
  await page.waitForTimeout(200);

  const card = await page.$('#card');
  if (!card) throw new Error('#card not found in og-card.html');

  // PNG (lossless archival)
  await card.screenshot({ path: OUT_PNG, type: 'png' });
  // JPG (production OG image, ~85 quality keeps it well under 300KB)
  await card.screenshot({ path: OUT_JPG, type: 'jpeg', quality: 82 });

  await browser.close();

  // Report file sizes
  const fs = await import('fs');
  const sizeKB = (p) => (fs.statSync(p).size / 1024).toFixed(1) + ' KB';
  console.log(`✓ Wrote ${OUT_JPG}  (${sizeKB(OUT_JPG)})`);
  console.log(`✓ Wrote ${OUT_PNG}  (${sizeKB(OUT_PNG)})`);
})();
