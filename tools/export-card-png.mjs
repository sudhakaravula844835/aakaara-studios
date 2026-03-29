#!/usr/bin/env node
/**
 * Export business card front & back as separate high-quality PNGs
 * 3.5" × 2" at 300 DPI = 1050 × 600 px (rendered at 3x = 3150 × 1800)
 * Ready for Staples / print shop upload
 */

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(__dirname, 'business-card-print.html');
const FRONT_PNG = path.join(__dirname, 'aakaara-card-front.png');
const BACK_PNG = path.join(__dirname, 'aakaara-card-back.png');

const CARD_W = 1050;
const CARD_H = 600;

async function main() {
  console.log('🎴 Exporting business card PNGs for print...');
  console.log(`   Target: 1050 × 600 px at 3x scale = 3150 × 1800 px`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  // 3x device scale = 3150×1800 actual pixels (300 DPI equivalent)
  await page.setViewport({ width: CARD_W, height: CARD_H * 2 + 20, deviceScaleFactor: 3 });

  await page.goto(`file://${INPUT}`, { waitUntil: 'networkidle0', timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 2000)); // extra wait for fonts + gradients

  // Front card
  const frontEl = await page.$('.card-front');
  await frontEl.screenshot({ path: FRONT_PNG, type: 'png' });
  console.log(`   ✅ Front → ${FRONT_PNG}`);

  // Back card
  const backEl = await page.$('.card-back');
  await backEl.screenshot({ path: BACK_PNG, type: 'png' });
  console.log(`   ✅ Back  → ${BACK_PNG}`);

  await browser.close();

  // Check file sizes
  const fs = await import('fs');
  const frontSize = (fs.statSync(FRONT_PNG).size / 1024 / 1024).toFixed(2);
  const backSize = (fs.statSync(BACK_PNG).size / 1024 / 1024).toFixed(2);

  console.log('\n📋 Ready to upload to Staples:');
  console.log(`   Front: ${frontSize} MB`);
  console.log(`   Back:  ${backSize} MB`);
  console.log(`   Dimensions: 3150 × 1800 px (300 DPI at 3.5" × 2")`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
