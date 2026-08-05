// tests/intake.spec.js
import { test, expect, devices } from '@playwright/test';

test.describe('Intake form', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/intake.html'); });

  test('renders all 4 sections', async ({ page }) => {
    await expect(page.locator('#step1')).toBeVisible();
    await expect(page.locator('#step2')).toBeVisible();
    await expect(page.locator('#step3')).toBeVisible();
    await expect(page.locator('#step4')).toBeVisible();
  });

  test('live streaming field shows when Yes selected', async ({ page }) => {
    await expect(page.locator('#liveEventsField')).toBeHidden();
    await page.locator('input[name="live"][value="yes"]').click();
    await expect(page.locator('#liveEventsField')).toBeVisible();
  });

  test('pre-wedding details show when Yes selected', async ({ page }) => {
    await expect(page.locator('#prewedDetails')).toBeHidden();
    await page.locator('input[name="prewed"][value="yes"]').click();
    await expect(page.locator('#prewedDetails')).toBeVisible();
  });

  test('day pills render correct number of day cards', async ({ page }) => {
    await page.locator('.day-pill[data-days="3"]').click();
    await expect(page.locator('.day-card')).toHaveCount(3);
  });

  test('add-event button respects 3-row maximum', async ({ page }) => {
    const addBtn = page.locator('.add-event-btn').first();
    await addBtn.click(); // 2
    await addBtn.click(); // 3
    await addBtn.click(); // should not add 4th
    await expect(page.locator('.day-card').first().locator('.event-row')).toHaveCount(3);
  });

  test('validation shows error for empty required fields', async ({ page }) => {
    await page.locator('#submitBtn').click();
    await expect(page.locator('#err-clientName')).not.toBeEmpty();
  });
});

test.describe('Intake form — touch devices', () => {
  const { defaultBrowserType, ...iPhone13 } = devices['iPhone 13'];
  test.use({ ...iPhone13 });

  // Regression test for a bug where flatpickr's native mobile date input
  // (which carries the "flatpickr-input" class same as the desktop altInput
  // setup) was being hidden by a leftover "#eventDate + .flatpickr-input"
  // CSS rule, leaving touch users with no way to select the event date.
  test('event date field renders a visible, fillable native date input', async ({ page }) => {
    await page.goto('/intake.html');
    const mobileDateInput = page.locator('#step2 input[type="date"]');
    await expect(mobileDateInput).toBeVisible();
    await mobileDateInput.fill('2026-12-15');
    await mobileDateInput.dispatchEvent('change');
    await expect(page.locator('#eventDate')).toHaveValue('2026-12-15');
  });
});

test.describe('Quote generator pre-fill', () => {
  test('populates client and schedule from URL params', async ({ page }) => {
    const days = JSON.stringify([{
      date: '2026-10-15',
      events: [{ name: 'Ceremony', dur: '3' }],
    }]);
    const params = new URLSearchParams({
      name: 'Test Client', email: 'test@example.com', phone: '555-1234',
      eventType: 'Wedding', venue: 'Test Venue', city: 'New York',
      live: 'yes', liveEvents: 'Ceremony', days,
    });
    await page.goto(`/admin/quote-generator.html?${params.toString()}`);

    await expect(page.locator('#clientName')).toHaveValue('Test Client');
    await expect(page.locator('#clientEmail')).toHaveValue('test@example.com');
    await expect(page.locator('#location')).toHaveValue('New York');
    await expect(page.locator('#customNotes')).toHaveValue(/Ceremony/);
    await expect(page.locator('.intake-prefill-banner')).toBeVisible();
    await expect(page.locator('.day-block')).toHaveCount(1);
  });

  test('skips pre-fill when name param absent', async ({ page }) => {
    await page.goto('/admin/quote-generator.html?foo=bar');
    await expect(page.locator('#clientName')).toHaveValue('');
    await expect(page.locator('.intake-prefill-banner')).toHaveCount(0);
  });
});
