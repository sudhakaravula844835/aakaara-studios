const { test, expect } = require('@playwright/test');
const { writeFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.goto('/admin/quote-generator.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.day-block')).toHaveCount(1);
  await page.locator('#clientName').fill('Quote Review');
  await page.locator('#eventType').selectOption('Wedding');
  await page.locator('#hourlyRate').fill('400');
  await page.locator('[data-field="date"]').evaluate(input => {
    if (input._flatpickr) input._flatpickr.setDate('2026-11-21', true);
    else {
      input.value = '2026-11-21';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await page.locator('[data-field="eventName"]').fill('Wedding');
  await page.locator('[data-field="eventDuration"]').fill('20 hours');
  await page.locator('[data-field="eventPhotos"]').fill('650');
  await page.locator('#delEdited').check();
  await expect(page.locator('#totalDisplay')).toHaveText('$8,000');
});

async function readPreview(page, testInfo, filename) {
  await page.locator('#previewBtn').click();
  await expect(page.locator('#previewModal')).toBeVisible();
  const bytes = await page.locator('#previewFrame').evaluate(async iframe =>
    Array.from(new Uint8Array(await (await fetch(iframe.src)).arrayBuffer())));
  const output = testInfo.outputPath(filename);
  writeFileSync(output, Buffer.from(bytes));
  return execFileSync('pdftotext', ['-layout', output, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ');
}

test('standard timeline is editable, saved, and restored by reset', async ({ page }) => {
  await expect(page.locator('#timeline')).toHaveValue('10–12 weeks');
  await expect(page.locator('#delAddlHours')).toBeChecked();
  await expect(page.locator('#delAddlHoursRate')).toHaveValue('150');
  await expect(page.locator('#pricingPreview')).toContainText('2 hours total per booking');
  await page.locator('#timeline').fill('8–10 weeks after final selections');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('aakaaraQuoteDraft:v2'))?.timeline)).toBe('8–10 weeks after final selections');
  await page.reload();
  await expect(page.locator('#timeline')).toHaveValue('8–10 weeks after final selections');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#resetBtn').click();
  await expect(page.locator('#timeline')).toHaveValue('10–12 weeks');
  await expect(page.locator('#delAddlHours')).toBeChecked();
  await expect(page.locator('#delAddlHoursRate')).toHaveValue('150');
});

test('livestream is charged only when selected and priced, and persists in the draft', async ({ page }, testInfo) => {
  await page.locator('#delLive').check();
  await expect(page.locator('#pricingPreview')).toContainText('excluded from estimate');
  await expect(page.locator('#totalDisplay')).toHaveText('$8,000');
  await page.locator('#delLiveFee').fill('650');
  await expect(page.locator('#totalDisplay')).toHaveText('$8,650');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('aakaaraQuoteDraft:v2'))?.delLiveFee)).toBe('650');
  await page.reload();
  await expect(page.locator('#delLiveFee')).toHaveValue('650');
  await expect(page.locator('#totalDisplay')).toHaveText('$8,650');
  const pdf = await readPreview(page, testInfo, 'priced-livestream.pdf');
  expect(pdf).toContain('Paid add-on: $650');
  expect(pdf).toContain('$8,650');
  expect(pdf).toContain('2 hours total per booking');
  expect(pdf).toContain('$150/hr');
  await page.locator('#closePreviewBtn').click();
  await page.locator('#delLive').uncheck();
  await expect(page.locator('#totalDisplay')).toHaveText('$8,000');
});

test('PDF defers payment terms, preserves custom delivery, and discloses an unpriced livestream', async ({ page }, testInfo) => {
  await page.locator('#delLive').check();
  await page.locator('#timeline').fill('12–14 weeks after the final event');
  // An older draft must not inject a retainer charge or old payment dates.
  await page.evaluate(() => {
    document.getElementById('retainerFee').value = '975';
    document.getElementById('deposit').value = 'LEGACY_DEPOSIT';
    document.getElementById('balanceDue').value = 'LEGACY_BALANCE';
    document.getElementById('retainerFee').dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#retainerFee')).toBeHidden();
  await expect(page.locator('#deposit')).toBeHidden();
  await expect(page.locator('#balanceDue')).toBeHidden();
  await expect(page.locator('#totalDisplay')).toHaveText('$8,000');
  const pdf = await readPreview(page, testInfo, 'quote-policy-preview.pdf');
  expect(pdf).toContain('Paid add-on; fee quoted separately');
  expect(pdf).toContain('Livestream fee is quoted separately and is not included in this estimate.');
  expect(pdf).toContain('2 complimentary extra hours total per booking, shared across all event days');
  expect(pdf).toContain('Further coverage after the complimentary hours');
  expect(pdf).toContain('12–14 weeks after the final event');
  expect(pdf).toContain('Deposit and remaining payment details will be shared in the contract after the final quote is agreed.');
  expect(pdf).toContain('1 TB for bookings with up to three events');
  expect(pdf).toContain('2 TB for bookings with more than three events');
  expect(pdf).toContain('within one week of the wedding day or the final scheduled event, whichever is later');
  expect(pdf).toContain('private, password-protected online gallery');
  expect(pdf).toContain('gallery link and password will be shared with the client');
  expect(pdf).not.toContain('Client assumes responsibility');
  expect(pdf).not.toContain('LEGACY_DEPOSIT');
  expect(pdf).not.toContain('LEGACY_BALANCE');
  expect(pdf).not.toContain('$975');
  expect(pdf).toContain('$8,000');
});
