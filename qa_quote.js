const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:9191';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const jsErrors = [];
  page.on('console', m => { if (m.type() === 'error') jsErrors.push('console.error: ' + m.text()); });
  page.on('pageerror', e => jsErrors.push('pageerror: ' + e.message));

  // ── 1. Load & initial state ──────────────────────────────────────────
  await page.goto(BASE + '/admin/quote-generator.html', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1500);
  const title = await page.title();
  const daysOnLoad = await page.locator('#daysContainer .day-block').count();
  const totalOnLoad = await page.locator('#totalDisplay').textContent();
  console.log('[1] title:', title);
  console.log('[1] day blocks on load:', daysOnLoad, '(expect 1)');
  console.log('[1] total on load:', totalOnLoad, '(expect $0)');
  await page.screenshot({ path: '/tmp/qg_01_load.png' });

  // ── 2. Fill client info ──────────────────────────────────────────────
  await page.fill('#clientName', 'Priya & Ravi Sharma');
  await page.fill('#clientEmail', 'priya@example.com');
  await page.selectOption('#eventType', 'Wedding');
  await page.fill('#venueName', 'The Plaza Hotel');
  await page.fill('#location', 'New York, NY');
  console.log('[2] client info filled');

  // ── 3. Set quoteDate (the bug fix: PDF should use this, not new Date()) ─
  // Flatpickr: set the underlying input directly and fire change
  await page.evaluate(() => {
    const input = document.getElementById('quoteDate');
    const fp = input._flatpickr;
    if (fp) fp.setDate('2026-11-15', true);
  });
  await page.waitForTimeout(300);
  const quoteDateVal = await page.evaluate(() => document.getElementById('quoteDate').value);
  console.log('[3] quoteDate value after set:', quoteDateVal, '(expect 2026-11-15)');

  // ── 4. Add events to first day ───────────────────────────────────────
  await page.locator('[data-field="eventName"]').first().fill('Baraat');
  await page.locator('[data-field="eventDuration"]').first().fill('2 hours');
  await page.locator('[data-field="eventPhotos"]').first().fill('150');
  await page.waitForTimeout(500);
  const hoursAfter2h = await page.locator('[data-field="hours"]').first().inputValue();
  console.log('[4] auto-hours after "2 hours":', hoursAfter2h, '(expect 2)');

  await page.locator('[data-action="addEvent"]').first().click();
  await page.waitForTimeout(200);
  await page.locator('[data-field="eventName"]').nth(1).fill('Pheras');
  await page.locator('[data-field="eventDuration"]').nth(1).fill('3 hours');
  await page.waitForTimeout(500);
  const hoursAfter5h = await page.locator('[data-field="hours"]').first().inputValue();
  console.log('[4] auto-hours after 2h+3h:', hoursAfter5h, '(expect 5)');

  // ── 5. Float precision probe ─────────────────────────────────────────
  await page.locator('[data-action="addEvent"]').first().click();
  await page.waitForTimeout(200);
  await page.locator('[data-field="eventDuration"]').nth(2).fill('0.1 hours');
  await page.waitForTimeout(500);
  const hoursFP = await page.locator('[data-field="hours"]').first().inputValue();
  const hasFloatGarbage = hoursFP.includes('000000') || hoursFP.includes('999999');
  console.log('[5] float precision (2+3+0.1h):', hoursFP, hasFloatGarbage ? '❌ float garbage!' : '✅ clean');

  // ── 6. Set pricing ───────────────────────────────────────────────────
  await page.fill('#hourlyRate', '350');
  await page.waitForTimeout(600);
  const totalWithRate = await page.locator('#totalDisplay').textContent();
  console.log('[6] total at $350/hr × 5.1h:', totalWithRate);

  // ── 7. Add/remove days — flatpickr destroy test ──────────────────────
  console.log('[7] add/remove cycle test...');
  const errsBefore = jsErrors.length;
  for (let i = 0; i < 4; i++) {
    await page.click('#addDayBtn');
    await page.waitForTimeout(150);
  }
  let days = await page.locator('#daysContainer .day-block').count();
  console.log('[7] after adding 4 more:', days, '(expect 5)');
  for (let i = 0; i < 4; i++) {
    await page.locator('[data-action="removeDay"]').last().click();
    await page.waitForTimeout(150);
  }
  days = await page.locator('#daysContainer .day-block').count();
  const errsAfter = jsErrors.length;
  console.log('[7] after removing 4:', days, '(expect 1)');
  console.log('[7] JS errors during add/remove:', errsAfter - errsBefore === 0 ? 'none ✅' : jsErrors.slice(errsBefore).join('\n'));

  // Check no orphaned flatpickr calendars visible
  const orphanCalendars = await page.locator('.flatpickr-calendar.open').count();
  console.log('[7] open calendars after cycles:', orphanCalendars, '(expect 0)');

  // ── 8. Preview PDF (tests generatePDF doesn't throw) ─────────────────
  console.log('[8] triggering PDF preview...');
  const errsBeforePDF = jsErrors.length;
  await page.click('#previewBtn');
  await page.waitForTimeout(3500);
  const modalClass = await page.locator('#previewModal').getAttribute('class');
  const iframeSrc = await page.locator('#previewFrame').getAttribute('src');
  const pdfErrors = jsErrors.slice(errsBeforePDF);
  console.log('[8] modal visible:', !modalClass.includes('hidden') ? '✅ yes' : '❌ no');
  console.log('[8] iframe blob src:', iframeSrc?.startsWith('blob:') ? '✅ set' : '❌ missing — ' + iframeSrc);
  console.log('[8] PDF generation errors:', pdfErrors.length === 0 ? 'none ✅' : pdfErrors.join('\n'));
  await page.screenshot({ path: '/tmp/qg_02_preview.png' });
  await page.click('#closePreviewBtn');
  await page.waitForTimeout(400);

  // ── 9. Overflow: many events across two days ─────────────────────────
  console.log('[9] overflow test — building large schedule...');
  await page.click('#addDayBtn');
  await page.waitForTimeout(300);

  // Add 8 events with notes to day 1 to push overflow
  for (let i = 0; i < 8; i++) {
    await page.locator('#daysContainer .day-block').first().locator('[data-action="addEvent"]').click();
    await page.waitForTimeout(100);
    const items = await page.locator('#daysContainer .day-block').first().locator('[data-event-item]').count();
    await page.locator('#daysContainer .day-block').first().locator('[data-field="eventName"]').nth(items - 1).fill(`Ceremony Pt ${i + 1}`);
    await page.locator('#daysContainer .day-block').first().locator('[data-field="eventDuration"]').nth(items - 1).fill('1 hour');
    await page.locator('#daysContainer .day-block').first().locator('[data-field="eventNotes"]').nth(items - 1).fill(`Location: venue hall ${i + 1}, floor 2`);
  }
  // Add 6 events to day 2
  for (let i = 0; i < 6; i++) {
    await page.locator('#daysContainer .day-block').nth(1).locator('[data-action="addEvent"]').click();
    await page.waitForTimeout(100);
    const items = await page.locator('#daysContainer .day-block').nth(1).locator('[data-event-item]').count();
    await page.locator('#daysContainer .day-block').nth(1).locator('[data-field="eventName"]').nth(items - 1).fill(`Reception Pt ${i + 1}`);
    await page.locator('#daysContainer .day-block').nth(1).locator('[data-field="eventDuration"]').nth(items - 1).fill('1 hour');
  }
  // Check many deliverables
  for (const id of ['delEdited','delGallery','delSneakPeek','delHighlight','delDoc','delDrone','delLive','delSecondShooter']) {
    await page.check(`#${id}`);
  }

  const errsBeforeOverflow = jsErrors.length;
  await page.click('#previewBtn');
  await page.waitForTimeout(4000);
  const overflowModal = await page.locator('#previewModal').getAttribute('class');
  const overflowSrc = await page.locator('#previewFrame').getAttribute('src');
  const overflowErrors = jsErrors.slice(errsBeforeOverflow);
  console.log('[9] overflow modal opened:', !overflowModal.includes('hidden') ? '✅' : '❌');
  console.log('[9] overflow iframe src:', overflowSrc?.startsWith('blob:') ? '✅' : '❌');
  console.log('[9] overflow errors:', overflowErrors.length === 0 ? 'none ✅' : overflowErrors.join('\n'));
  await page.screenshot({ path: '/tmp/qg_03_overflow.png' });
  await page.click('#closePreviewBtn');

  // ── 10. Draft auto-save ──────────────────────────────────────────────
  await page.waitForTimeout(1200);
  const draftText = await page.locator('#draftIndicator').textContent();
  const hasSaveTime = /saved \d/.test(draftText);
  console.log('[10] draft indicator:', JSON.stringify(draftText), hasSaveTime ? '✅' : '⚠️');

  // ── 11. Reset — flatpickr destroy test ───────────────────────────────
  console.log('[11] reset test...');
  const errsBeforeReset = jsErrors.length;
  page.once('dialog', d => d.accept());
  await page.click('#resetBtn');
  await page.waitForTimeout(800);
  const daysAfterReset = await page.locator('#daysContainer .day-block').count();
  const nameAfterReset = await page.locator('#clientName').inputValue();
  const resetErrors = jsErrors.slice(errsBeforeReset);
  console.log('[11] days after reset:', daysAfterReset, '(expect 1)');
  console.log('[11] name cleared:', nameAfterReset === '' ? '✅' : '❌ still: ' + nameAfterReset);
  console.log('[11] reset errors:', resetErrors.length === 0 ? 'none ✅' : resetErrors.join('\n'));
  await page.screenshot({ path: '/tmp/qg_04_reset.png' });

  // ── 12. Draft reload ─────────────────────────────────────────────────
  console.log('[12] draft reload test...');
  await page.fill('#clientName', 'Draft Test User');
  await page.fill('#hourlyRate', '500');
  await page.waitForTimeout(1200); // let draft save
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const nameAfterReload = await page.locator('#clientName').inputValue();
  const rateAfterReload = await page.locator('#hourlyRate').inputValue();
  console.log('[12] name restored from draft:', nameAfterReload, nameAfterReload === 'Draft Test User' ? '✅' : '❌');
  console.log('[12] rate restored from draft:', rateAfterReload, rateAfterReload === '500' ? '✅' : '❌');

  // ── 13. Hours-auto manual override then clear ────────────────────────
  console.log('[13] hours-auto override test...');
  page.once('dialog', d => d.accept());
  await page.click('#resetBtn');
  await page.waitForTimeout(500);
  await page.locator('[data-field="eventDuration"]').first().fill('4 hours');
  await page.waitForTimeout(400);
  const hoursAuto = await page.locator('[data-field="hours"]').first().inputValue();
  console.log('[13] auto after 4h duration:', hoursAuto, '(expect 4)');
  // Manual override
  await page.locator('[data-field="hours"]').first().triple_click?.() || await page.locator('[data-field="hours"]').first().click({ clickCount: 3 });
  await page.locator('[data-field="hours"]').first().fill('10');
  await page.waitForTimeout(300);
  const hoursClass = await page.locator('[data-field="hours"]').first().getAttribute('class') ?? '';
  console.log('[13] class after manual entry:', hoursClass, hoursClass.includes('hours-auto') ? '❌ still auto' : '✅ manual');
  // Clear → auto should re-engage when duration is touched
  await page.locator('[data-field="hours"]').first().fill('');
  await page.locator('[data-field="eventDuration"]').first().fill('4 hours');
  await page.waitForTimeout(400);
  const hoursReAuto = await page.locator('[data-field="hours"]').first().inputValue();
  console.log('[13] re-auto after clear+duration:', hoursReAuto, '(expect 4)');

  // ── 14. All collected errors ─────────────────────────────────────────
  console.log('\n[ALL ERRORS]', jsErrors.length === 0 ? 'none' : '\n' + jsErrors.join('\n'));

  await browser.close();
  console.log('\nDONE');
})().catch(e => { console.error('SCRIPT_FATAL:', e.message, e.stack); process.exit(1); });
