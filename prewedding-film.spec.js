const { test, expect } = require('@playwright/test');

test('opens Nisaanth and Vasavi’s Chicago pre-wedding film', async ({ page }) => {
  await page.route('**/*.m3u8', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#intro')).toBeHidden({ timeout: 10000 });

  await page.locator('#video-works').scrollIntoViewIfNeeded();
  await page.locator('.vw-filters button[data-filter="prewedding"]').click();

  const card = page.locator('.vw-card[data-title="Nisaanth & Vasavi"]');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute(
    'data-video',
    'https://vz-757250d0-999.b-cdn.net/c1464f58-9334-46bd-adff-0ce86e69ef64/playlist.m3u8'
  );

  await page.locator('#videoCarousel .ec-next').click();
  await expect(card).toHaveAttribute('data-ec-offset', '1');

  // The carousel ignores clicks for ~0.5 s after it moves (so a double-click
  // can't open a film by accident), so retry each click until it takes.
  await expect(async () => {
    await card.click();
    await expect(card).toHaveAttribute('data-ec-offset', '0', { timeout: 400 });
  }).toPass({ timeout: 5000 });
  await expect(async () => {
    await card.click();
    await expect(page.locator('#videoModal')).toHaveClass(/vm-open/, { timeout: 400 });
  }).toPass({ timeout: 5000 });
  await expect(page.locator('#vmTitle')).toHaveText('Nisaanth & Vasavi');
  await expect(page.locator('#vmSubtitle')).toHaveText('Pre-Wedding Film · Chicago');
});
