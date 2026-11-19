// Shared test cases for the home-page services spiral (#services-overview).
// Run per engine by services-spiral.spec.js (Chromium) and
// services-spiral.webkit.spec.js (WebKit). Spec:
// docs/superpowers/specs/2026-11-18-services-spiral-design.md
module.exports = function defineSpiralTests(test, expect) {
  const skipIntro = () => sessionStorage.setItem('skipIntro', '1');
  const SETTLE_MS = 1500;
  const CARDS = 5;              // Maternity removed 2026-11-19: five services
  const STEPS = CARDS - 1;

  // Document Y at which the orbit shows card `step` (0–5), measured in-page.
  const stepY = (page, step) => page.evaluate(n => {
    const track = document.querySelector('#services-overview .sov-track');
    const top = track.getBoundingClientRect().top + window.scrollY;
    return Math.round(top + n * (track.offsetHeight - window.innerHeight) / (document.querySelectorAll('#services-overview .sov-card').length - 1));
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
      const expectedH = (1 + STEPS * 0.5) * 900; // 100vh stage + 50vh per step
      expect(Math.abs(trackH - expectedH) / expectedH).toBeLessThanOrEqual(0.02);
      const transforms = await page.locator('#services-overview .sov-card').evaluateAll(els => els.map(e => e.style.transform));
      expect(transforms).toHaveLength(CARDS);
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
      expect(await position(page)).toBe(String(STEPS));
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

  test.describe('Services spiral — settling, focus, anchors, analytics', () => {
    test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(skipIntro);
      await page.route(/googletagmanager\.com/, route => route.abort()); // keep test events out of real analytics
    });

    test('stops on a whole card', async ({ page }) => {
      // The orbit settles on the nearest card when scrolling pauses; the page itself stays put.
      await page.goto('/');
      const y1 = await stepY(page, 1);
      const y2 = await stepY(page, 2);
      await jump(page, y1);
      await page.waitForTimeout(600);
      await page.mouse.move(720, 450);
      await page.mouse.wheel(0, Math.round((y2 - y1) * 0.4));
      await page.waitForTimeout(SETTLE_MS);
      const y = await page.evaluate(() => window.scrollY);
      expect(y, 'page must not be snapped').toBeGreaterThan(y1 + 20);
      expect(y).toBeLessThan(y2 - 20);
      expect(await position(page)).toBe('1');
      const front = await page.locator('#services-overview .sov-card').nth(1).evaluate(e => e.style.transform);
      expect(front).toMatch(/rotateY\(0(\.0)?deg\)/); // browsers normalise 0.0deg → 0deg
    });

    test('slow wheel scrolling is never pulled back', async ({ page }) => {
      await page.goto('/');
      await jump(page, await stepY(page, 1));
      await page.waitForTimeout(600);
      await page.mouse.move(720, 450);
      let last = await page.evaluate(() => window.scrollY);
      for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, 100);
        await page.waitForTimeout(500);
        const y = await page.evaluate(() => window.scrollY);
        expect(y, `wheel ${i + 1}`).toBeGreaterThan(last + 50);
        last = y;
      }
    });

    test('slow scroll leaves and approaches the section freely', async ({ page }) => {
      await page.goto('/');
      const lastY = await stepY(page, STEPS);
      await jump(page, lastY);
      await page.waitForTimeout(600);
      await page.mouse.move(720, 450);
      await page.mouse.wheel(0, 150);
      await page.waitForTimeout(1000);
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(lastY + 120);
      const above = (await stepY(page, 0)) - 250;
      await jump(page, above);
      await page.waitForTimeout(1000);
      expect(Math.abs(await page.evaluate(() => window.scrollY) - above)).toBeLessThanOrEqual(2);
    });

    test('pressing the mouse on a side card link does not move the page', async ({ page }) => {
      await page.goto('/');
      await jump(page, await stepY(page, 0));
      await page.waitForTimeout(SETTLE_MS);
      const box = await page.locator('#services-overview .sov-card').nth(1).locator('.sov-link').first().boundingBox();
      const before = await page.evaluate(() => window.scrollY);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(400);
      const during = await page.evaluate(() => window.scrollY);
      await page.mouse.up();
      expect(during).toBe(before);
    });

    test.describe('keyboard focus', () => {
      // Under load, Chrome's own focus scroll-into-view used to cancel the
      // spiral's scroll; Script.js now defers it a frame. No retries needed.

      test('tabbing to Inquire brings the card forward', async ({ page }) => {
        await page.goto('/');
        await jump(page, await stepY(page, 0));
        await page.waitForTimeout(600);
        // Keyboard focus without relying on Tab order (Chrome's Tab start point
        // drifted in long serial runs): a key press first makes the next focus
        // count as keyboard focus (:focus-visible), as it does for Tab users.
        const link = page.locator('#services-overview .sov-card').nth(4).locator('.sov-link').first();
        await page.bringToFront();
        await page.keyboard.press('Shift');
        await link.focus();
          // A ~1800px smooth scroll plus the spring can exceed 1.5s on a busy machine.
        await expect.poll(() => position(page), { timeout: 5000 }).toBe('4');
        await page.waitForTimeout(600); // let the orbit finish settling
        const op = await page.locator('#services-overview .sov-card').nth(4).evaluate(e => Number(e.style.opacity));
        expect(op).toBeGreaterThanOrEqual(0.99);
        const box = await link.boundingBox();
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(900);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(1440);
      });
    });

    test('nav Services link lands on card 01', async ({ page }) => {
      await page.goto('/');
      await page.locator('#navbar a[href="#services-overview"]').click();
      await page.waitForTimeout(SETTLE_MS * 2);
      expect(await position(page)).toBe('0');
      const navBottom = await page.locator('#navbar').evaluate(n => n.getBoundingClientRect().bottom);
      const titleTop = await page.locator('#services-overview .sov-intro .section-title').evaluate(t => t.getBoundingClientRect().top);
      expect(titleTop).toBeGreaterThanOrEqual(navBottom);
    });

    test('services_viewed still fires', async ({ page }) => {
      await page.goto('/');
      await jump(page, await stepY(page, 0));
      await page.waitForTimeout(SETTLE_MS);
      const events = await page.evaluate(() => (window.dataLayer || [])
        .filter(a => a && a[0] === 'event' && a[1] === 'services_viewed').length);
      expect(events).toBe(1);
    });
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
        await expect(cards).toHaveCount(CARDS);
        const sizes = await cards.evaluateAll(els => els.map(e => [e.offsetWidth, e.offsetHeight]));
        for (const [w, h] of sizes) {
          expect(Math.abs(w - 342)).toBeLessThanOrEqual(2);
          expect(h).toBeLessThanOrEqual(96);
        }
        const meanings = page.locator('#services-overview .sov-meaning');
        await expect(meanings).toHaveCount(CARDS);
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
      await expect(page.locator('#services-overview .sov-track .sov-stage .sov-grid .sov-card')).toHaveCount(CARDS);
      await expect(page.locator('#services-overview .sov-intro .section-title')).toContainText('Five Ways');
      await expect(page.locator('#services-overview .sov-card--maternity')).toHaveCount(0);
      await expect(page.locator('#services-overview .sov-step')).toHaveCount(0); // no snap points: they caught slow scrolling
      await expect(page.locator('#services-overview [data-sov-current]')).toHaveText('01');
      const langs = await page.locator('#services-overview .sov-sa').evaluateAll(els => els.map(e => e.getAttribute('lang')));
      expect(langs).toEqual(Array(CARDS).fill('sa-Latn'));
    });
  });
};
