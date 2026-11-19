// Shared test cases for the home-page services orbit (#services-overview).
// Desktop shows a copy of the first spiral on animation_spatial_gallery.html
// (same cards, size, paths and wheel behaviour); phones and tablets keep the
// services list. Run per engine by services-spiral.spec.js (Chromium) and
// services-spiral.webkit.spec.js (WebKit).
module.exports = function defineSpiralTests(test, expect) {
  const skipIntro = () => sessionStorage.setItem('skipIntro', '1');
  const SETTLE_MS = 1200;
  const CARDS = 5;
  const TITLES = ['Weddings', 'Engagement', 'Pre-wedding', 'Celebrations', 'Conceptual'];

  const section = page => page.locator('#services-overview');
  const position = page => section(page).getAttribute('data-sov-position');
  const sectionTop = page => page.evaluate(() => Math.round(
    document.getElementById('services-overview').getBoundingClientRect().top + window.scrollY));
  const jump = (page, y) => page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), y);
  const scrollY = page => page.evaluate(() => Math.round(window.scrollY));
  // Bring the section flush with the viewport, as the study expects before it turns.
  async function arrive(page) {
    await jump(page, await sectionTop(page));
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.move(720, 450);
  }
  async function wheel(page, dy) {
    await page.mouse.wheel(0, dy);
    await page.waitForTimeout(SETTLE_MS);
  }

  test.describe('Services orbit — desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false });
    test.beforeEach(async ({ page }) => { await page.addInitScript(skipIntro); });

    test('the study orbit replaces the services list', async ({ page }) => {
      await page.goto('/');
      await expect(section(page)).toHaveClass(/sov-orbit-on/);
      await expect(page.locator('#services-overview .sov-orbit')).toBeVisible();
      await expect(page.locator('#services-overview .sov-grid')).toBeHidden();
      const titles = await page.locator('#services-overview .sov-orbit-card h3').allTextContents();
      expect(titles.map(t => t.split('/').pop().trim())).toEqual(TITLES);
      const height = await section(page).evaluate(s => s.offsetHeight);
      expect(height).toBe(900); // one screen, like the study
    });

    test('cards are the study size and the front card faces forward', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      const card = page.locator('#services-overview .sov-orbit-card').first();
      const [w, h] = await card.evaluate(e => [e.offsetWidth, e.offsetHeight]);
      expect(w).toBe(560);
      expect(Math.abs(h - 394)).toBeLessThanOrEqual(1);
      expect(await card.evaluate(e => e.style.transform)).toMatch(/rotateY\(0(\.0+)?deg\)/);
      expect(await position(page)).toBe('0');
    });

    test('one wheel gesture turns one card and holds the page', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      const before = await scrollY(page);
      await wheel(page, 120);
      expect(await position(page)).toBe('1');
      expect(Math.abs(await scrollY(page) - before)).toBeLessThanOrEqual(1);
      await wheel(page, -120);
      expect(await position(page)).toBe('0');
    });

    test('after the last card the page moves on, and comes back to it', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      const top = await scrollY(page);
      for (let i = 0; i < CARDS - 1; i++) await wheel(page, 120);
      expect(await position(page)).toBe(String(CARDS - 1));
      await wheel(page, 400);
      await wheel(page, 400);
      expect(await scrollY(page)).toBeGreaterThan(top + 100);
      await jump(page, top);
      await page.waitForTimeout(300);
      await wheel(page, -120);
      expect(await position(page)).toBe(String(CARDS - 2));
    });

    test('a wheel just short of the section glides it into place first', async ({ page }) => {
      await page.goto('/');
      await jump(page, (await sectionTop(page)) - 200);
      await page.waitForTimeout(SETTLE_MS);
      await page.mouse.move(720, 450);
      await wheel(page, 60);
      const top = await section(page).evaluate(s => s.getBoundingClientRect().top);
      expect(Math.abs(top)).toBeLessThanOrEqual(1);
      expect(await position(page)).toBe('0');
    });

    test('only the front card and the next one load their video', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      const loaded = await page.locator('#services-overview .sov-orbit-card video source')
        .evaluateAll(els => els.map(s => !!s.getAttribute('src')));
      expect(loaded).toEqual([true, true, false, false, false]);
    });

    test('reduced motion still turns, without the glide', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      await arrive(page);
      await expect(section(page)).toHaveClass(/sov-orbit-on/);
      await wheel(page, 120);
      expect(await position(page)).toBe('1');
    });

    for (const width of [1440, 1920]) {
      test(`no horizontal overflow at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/');
        await arrive(page);
        for (let i = 0; i < CARDS; i++) {
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(overflow).toBeLessThanOrEqual(0);
          await wheel(page, 120);
        }
      });
    }

    test('resize to compact brings the list back', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      await page.setViewportSize({ width: 1024, height: 768 });
      await expect(section(page)).not.toHaveClass(/sov-orbit-on/);
      await expect(page.locator('#services-overview .sov-orbit')).toBeHidden();
      await expect(page.locator('#services-overview .sov-grid')).toBeVisible();
    });

    test('nav Services link shows the heading below the nav', async ({ page }) => {
      await page.goto('/');
      await page.locator('#navbar a[href="#services-overview"]').click();
      await page.waitForTimeout(SETTLE_MS * 2);
      const navBottom = await page.locator('#navbar').evaluate(n => n.getBoundingClientRect().bottom);
      const titleTop = await page.locator('#services-overview .sov-orbit-title').evaluate(t => t.getBoundingClientRect().top);
      expect(titleTop).toBeGreaterThanOrEqual(navBottom);
    });

    test('services_viewed still fires', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      const events = await page.evaluate(() => (window.dataLayer || [])
        .filter(a => a && a[0] === 'event' && a[1] === 'services_viewed').length);
      expect(events).toBe(1);
    });
  });

  test.describe('Services orbit — compact keeps the list', () => {
    test.describe('phone', () => {
      test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

      test('phone keeps the contact-sheet list', async ({ page }) => {
        await page.addInitScript(skipIntro);
        await page.goto('/');
        await expect(section(page)).not.toHaveClass(/sov-orbit-on/);
        await expect(page.locator('#services-overview .sov-orbit')).toBeHidden();
        const cards = page.locator('#services-overview .sov-card');
        await expect(cards).toHaveCount(CARDS);
        const sizes = await cards.evaluateAll(els => els.map(e => [e.offsetWidth, e.offsetHeight]));
        for (const [w, h] of sizes) {
          expect(Math.abs(w - 342)).toBeLessThanOrEqual(2);
          expect(h).toBeLessThanOrEqual(96);
        }
      });
    });

    test.describe('tablet', () => {
      test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true });

      test('tablet keeps the 2-column grid', async ({ page }) => {
        await page.addInitScript(skipIntro);
        await page.goto('/');
        await expect(page.locator('#services-overview .sov-orbit')).toBeHidden();
        const columns = await page.locator('#services-overview .sov-grid')
          .evaluate(g => getComputedStyle(g).gridTemplateColumns.trim().split(/\s+/).length);
        expect(columns).toBe(2);
      });
    });

    test('the list has five services, numbered 01–05', async ({ page }) => {
      await page.addInitScript(skipIntro);
      await page.goto('/');
      await expect(page.locator('#services-overview .sov-intro .section-title')).toContainText('Five Ways');
      await expect(page.locator('#services-overview .sov-card--maternity')).toHaveCount(0);
      const nums = await page.locator('#services-overview .sov-num').allTextContents();
      expect(nums).toEqual(['01', '02', '03', '04', '05']);
    });
  });
};
