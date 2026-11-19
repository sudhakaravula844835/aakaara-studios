// Shared test cases for the home-page services spiral (#services-overview).
// Run per engine by services-spiral.spec.js (Chromium) and
// services-spiral.webkit.spec.js (WebKit). Spec:
// docs/superpowers/specs/2026-11-18-services-spiral-design.md
module.exports = function defineSpiralTests(test, expect) {
  const skipIntro = () => sessionStorage.setItem('skipIntro', '1');

  test.describe('Services spiral — compact parity', () => {
    test.describe('phone', () => {
      test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

      test('phone keeps the contact-sheet list', async ({ page }) => {
        await page.addInitScript(skipIntro);
        await page.goto('/');
        const cards = page.locator('#services-overview .sov-card');
        await expect(cards).toHaveCount(6);
        const sizes = await cards.evaluateAll(els => els.map(e => [e.offsetWidth, e.offsetHeight]));
        for (const [w, h] of sizes) {
          expect(Math.abs(w - 342)).toBeLessThanOrEqual(2);
          expect(h).toBeLessThanOrEqual(96);
        }
        const meanings = page.locator('#services-overview .sov-meaning');
        await expect(meanings).toHaveCount(6);
        const displays = await meanings.evaluateAll(els => els.map(e => getComputedStyle(e).display));
        expect(displays.every(d => d === 'none')).toBe(true);
        await expect(page.locator('#services-overview')).not.toHaveClass(/sov-spiral-on/);
      });
    });

    test.describe('tablet', () => {
      test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true });

      test('tablet keeps the 2-column grid', async ({ page }) => {
        await page.addInitScript(skipIntro);
        await page.goto('/');
        const columns = await page.locator('#services-overview .sov-grid')
          .evaluate(g => getComputedStyle(g).gridTemplateColumns.trim().split(/\s+/).length);
        expect(columns).toBe(2);
        const width = await page.locator('#services-overview .sov-card').first().evaluate(e => e.offsetWidth);
        expect(Math.abs(width - 455)).toBeLessThanOrEqual(2);
      });
    });

    test('markup carries the spiral hooks', async ({ page }) => {
      await page.addInitScript(skipIntro);
      await page.goto('/');
      await expect(page.locator('#services-overview .sov-track .sov-stage .sov-grid .sov-card')).toHaveCount(6);
      await expect(page.locator('#services-overview .sov-track > .sov-step')).toHaveCount(6);
      await expect(page.locator('#services-overview [data-sov-current]')).toHaveText('01');
      const langs = await page.locator('#services-overview .sov-sa').evaluateAll(els => els.map(e => e.getAttribute('lang')));
      expect(langs).toEqual(Array(6).fill('sa-Latn'));
    });
  });
};
