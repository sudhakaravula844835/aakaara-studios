// Links whose href is only "#" (every portfolio card) must not trip the
// smooth-scroll handler, which looks the href up as a selector.
const { test, expect } = require('@playwright/test');

test('clicking a portfolio card opens the gallery without a script error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => sessionStorage.setItem('skipIntro', '1'));
  await page.goto('/');
  await page.waitForTimeout(1500);
  // dispatch the click straight to the card, as a visitor's click on it would
  await page.evaluate(() => document.querySelector('#galleryGrid a.gallery-item[href="#"], a.gallery-item[href="#"]').click());
  await expect(page.locator('#swGallery')).toHaveClass(/sw-open/);
  expect(errors).toEqual([]);
});

test('in-page links still scroll to their section', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('skipIntro', '1'));
  await page.goto('/');
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector('a[href="#contact"]').click());
  await expect.poll(() => page.evaluate(() => Math.abs(document.getElementById('contact').getBoundingClientRect().top)), { timeout: 5000 }).toBeLessThan(150);
});
