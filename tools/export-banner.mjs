import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'youtube-banner.html');
const outputPath = path.join(__dirname, 'aakaara-youtube-banner.png');

(async () => {
  console.log('🎬 Exporting YouTube banner...');

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set viewport to exact banner dimensions
  await page.setViewport({ width: 2048, height: 1152, deviceScaleFactor: 1 });

  // Load the HTML file
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 15000 });

  // Wait for fonts to load
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 1500));

  // Hide export controls so they don't appear in screenshot
  await page.evaluate(() => {
    document.querySelector('.export-controls')?.remove();
    document.querySelector('.info-text')?.remove();
  });

  // Take full page screenshot at exact viewport size (2048x1152)
  await page.screenshot({
    path: outputPath,
    type: 'png',
    clip: { x: 0, y: 0, width: 2048, height: 1152 }
  });

  await browser.close();

  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`✅ Banner exported!`);
  console.log(`   File: ${outputPath}`);
  console.log(`   Size: ${sizeMB} MB (YouTube max: 6 MB)`);
  console.log(`   Dimensions: 2048 × 1152 px`);
})();
