const { test, expect, devices } = require('@playwright/test');

const mobileDevices = [
  ['iPhone SE', devices['iPhone SE']],
  ['Pixel 7', devices['Pixel 7']],
];

for (const [label, device] of mobileDevices) {
  const { defaultBrowserType, ...emulation } = device;

  test.describe(`Aakaara mobile regression checks — ${label}`, () => {
    test.use({ ...emulation });

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
    });

    test('shows the hero immediately without overflowing the wordmark', async ({ page }) => {
      await expect(page.locator('#intro')).toBeHidden({ timeout: 1500 });
      await expect(page.locator('#heroContent')).toBeVisible();
      await expect(page.locator('.hero-tagline')).toHaveText('Every story deserves its own canvas.');

      const box = await page.locator('#heroTitle').boundingBox();
      const viewport = page.viewportSize();
      expect(box).not.toBeNull();
      expect(viewport).not.toBeNull();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    });

    test('uses native horizontal scroll for portfolio and exposes touch-safe video controls', async ({ page }) => {
      await page.locator('#portfolio').scrollIntoViewIfNeeded();

      const trackStyles = await page.locator('#portfolioCarousel .ec-track').evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          overflowX: style.overflowX,
          scrollSnapType: style.scrollSnapType,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        };
      });

      expect(trackStyles.overflowX).toBe('auto');
      expect(trackStyles.scrollSnapType).toContain('x');
      expect(trackStyles.scrollWidth).toBeGreaterThan(trackStyles.clientWidth);

      await page.locator('#video-works').scrollIntoViewIfNeeded();
      await page.locator('.vw-card').first().click();
      await expect(page.locator('#videoModal')).toHaveClass(/vm-open/);

      const modalState = await page.evaluate(() => ({
        controlsOpacity: getComputedStyle(document.getElementById('vmControls')).opacity,
        muted: document.getElementById('vmVideo').muted,
        bodyOverflow: getComputedStyle(document.body).overflow,
      }));

      expect(modalState.controlsOpacity).toBe('1');
      expect(modalState.muted).toBe(true);
      expect(modalState.bodyOverflow).toBe('hidden');
    });

    test('uses native mobile date fields and 16px booking inputs', async ({ page }) => {
      await page.locator('#contact').scrollIntoViewIfNeeded();

      const formState = await page.evaluate(() => {
        const from = document.getElementById('dateFrom');
        const email = document.getElementById('contactEmail');
        return {
          dateType: from.type,
          dateMin: from.min,
          inputFontSize: getComputedStyle(email).fontSize,
        };
      });

      expect(formState.dateType).toBe('date');
      expect(formState.dateMin).not.toBe('');
      expect(formState.inputFontSize).toBe('16px');
    });

    test('defers heavy libraries and preserves scroll position after closing a film', async ({ page }) => {
      const initialState = await page.evaluate(() => ({
        hasHlsScript: [...document.scripts].some(script => script.src.includes('hls.js')),
        hasFlatpickrScript: [...document.scripts].some(script => script.src.includes('flatpickr')),
      }));

      expect(initialState.hasHlsScript).toBe(false);
      expect(initialState.hasFlatpickrScript).toBe(false);

      await page.locator('#video-works').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const before = await page.evaluate(() => window.scrollY);

      await page.locator('.vw-card').first().click();
      await expect(page.locator('#videoModal')).toHaveClass(/vm-open/);
      await page.locator('#vmClose').click();
      await expect(page.locator('#videoModal')).not.toHaveClass(/vm-open/);

      const after = await page.evaluate(() => window.scrollY);
      expect(Math.abs(after - before)).toBeLessThanOrEqual(2);
    });
  });
}
