// Shared test cases for the home-page services spiral (#services-overview).
// Run per engine by services-spiral.spec.js (Chromium) and
// services-spiral.webkit.spec.js (WebKit). Spec:
// docs/superpowers/specs/2026-11-18-services-spiral-design.md
module.exports = function defineSpiralTests(test, expect) {
  const skipIntro = () => sessionStorage.setItem('skipIntro', '1');
  const SETTLE_MS = 1500;

  // Document Y at which the orbit shows card `step` (0–5), measured in-page.
  const stepY = (page, step) => page.evaluate(n => {
    const track = document.querySelector('#services-overview .sov-track');
    const top = track.getBoundingClientRect().top + window.scrollY;
    return Math.round(top + n * (track.offsetHeight - window.innerHeight) / 5);
  }, step);
  const jump = (page, y) => page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), y);
  const position = page => page.locator('#services-overview').getAttribute('data-sov-position');

  test.describe('Services spiral — desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false });
    test.beforeEach(async ({ page }) => { await page.addInitScript(skipIntro); });

    test('spiral turns on', async ({ page }) => {
      await page.goto('/');
      const section = page.locator('#services-overview');
      await expect(section).toHaveClass(/sov-spiral-on/);
      const trackH = await page.locator('#services-overview .sov-track').evaluate(t => t.offsetHeight);
      expect(Math.abs(trackH - 3.5 * 900) / (3.5 * 900)).toBeLessThanOrEqual(0.02);
      const transforms = await page.locator('#services-overview .sov-card').evaluateAll(els => els.map(e => e.style.transform));
      expect(transforms).toHaveLength(6);
      for (const t of transforms) expect(t).toContain('rotateY');
      await expect(section).toHaveAttribute('data-sov-position', '0');
      await expect(page.locator('#services-overview .sov-meaning').first()).toBeVisible();
    });

    test('scroll turns the orbit', async ({ page }) => {
      await page.goto('/');
      await jump(page, await stepY(page, 3));
      await page.waitForTimeout(SETTLE_MS);
      expect(await position(page)).toBe('3');
      await expect(page.locator('#services-overview [data-sov-current]')).toHaveText('04');
      const cards = await page.locator('#services-overview .sov-card').evaluateAll(els =>
        els.map(e => ({ z: Number(e.style.zIndex), op: Number(e.style.opacity) })));
      const maxZ = Math.max(...cards.map(c => c.z));
      expect(cards[3].z).toBe(maxZ);
      expect(cards[3].op).toBeGreaterThanOrEqual(0.99);
    });

    test('never traps scrolling', async ({ page }) => {
      await page.goto('/');
      await jump(page, await stepY(page, 0));
      await page.waitForTimeout(300);
      let last = await page.evaluate(() => window.scrollY);
      let reachedContact = false;
      for (let i = 0; i < 40 && !reachedContact; i++) {
        await page.keyboard.press('PageDown');
        await page.waitForTimeout(700);
        const y = await page.evaluate(() => window.scrollY);
        expect(y).toBeGreaterThan(last);
        last = y;
        reachedContact = await page.evaluate(() => document.getElementById('contact').getBoundingClientRect().top < window.innerHeight);
      }
      expect(reachedContact).toBe(true);
    });

    test('fling past and back', async ({ page }) => {
      await page.goto('/');
      await page.keyboard.press('End');
      await page.waitForTimeout(SETTLE_MS * 2);
      expect(await position(page)).toBe('5');
      await jump(page, await stepY(page, 0));
      await page.waitForTimeout(SETTLE_MS);
      expect(await position(page)).toBe('0');
    });

    test('resize to compact switches off', async ({ page }) => {
      await page.goto('/');
      await jump(page, await stepY(page, 2));
      await page.waitForTimeout(SETTLE_MS);
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForTimeout(300);
      await expect(page.locator('#services-overview')).not.toHaveClass(/sov-spiral-on/);
      const inline = await page.locator('#services-overview .sov-card').evaluateAll(els => els.map(e => e.style.transform));
      expect(inline.every(t => t === '')).toBe(true);
    });

    test('restored scroll renders the right card', async ({ page }) => {
      // Coming back from /couple-portraits: Script.js restores returnScrollY.
      await page.goto('/');
      const y = await stepY(page, 4);
      await page.evaluate(v => sessionStorage.setItem('returnScrollY', String(v)), y);
      await page.goto('/');
      await page.waitForTimeout(SETTLE_MS * 2);
      expect(await position(page)).toBe('4');
    });

    test('reduced motion keeps the grid', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      await expect(page.locator('#services-overview')).not.toHaveClass(/sov-spiral-on/);
      const columns = await page.locator('#services-overview .sov-grid')
        .evaluate(g => getComputedStyle(g).gridTemplateColumns.trim().split(/\s+/).length);
      expect(columns).toBe(3);
    });

    for (const width of [1440, 1920]) {
      test(`no horizontal overflow at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/');
        for (const step of [0, 2, 5]) {
          await jump(page, await stepY(page, step));
          await page.waitForTimeout(SETTLE_MS);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(overflow).toBeLessThanOrEqual(0);
        }
      });
    }
  });

  test.describe('Services spiral — after the intro', () => {
    test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false });

    test('works after the intro', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(5000);
      await expect(page.locator('body')).not.toHaveClass(/intro-active/);
      await jump(page, await stepY(page, 2));
      await page.waitForTimeout(SETTLE_MS);
      expect(await position(page)).toBe('2');
    });
  });

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
