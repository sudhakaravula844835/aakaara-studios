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
  // Re-check: images still loading above can shift it after the first jump, and a
  // misaligned section spends the next wheel on aligning (correct, but not a turn).
  async function arrive(page) {
    await jump(page, await sectionTop(page));
    await page.waitForTimeout(SETTLE_MS);
    for (let i = 0; i < 3; i++) {
      const top = await section(page).evaluate(s => s.getBoundingClientRect().top);
      if (Math.abs(top) <= 1) break;
      await jump(page, await sectionTop(page));
      await page.waitForTimeout(400);
    }
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
      await expect(page.locator('#services-overview .sov-orbit-title')).toHaveText('Five Ways We Tell Your Story');
      const titles = await page.locator('#services-overview .sov-orbit-card h3').allTextContents();
      expect(titles.map(t => t.split('/').pop().trim())).toEqual(TITLES);
      const height = await section(page).evaluate(s => s.offsetHeight);
      expect(height).toBe(900); // one screen, like the study
    });

    test('cards are 28rem (80% of the study) and the front card faces forward', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      const card = page.locator('#services-overview .sov-orbit-card').first();
      const [w, h] = await card.evaluate(e => [e.offsetWidth, e.offsetHeight]);
      expect(w).toBe(448);
      expect(Math.abs(h - 315.5)).toBeLessThanOrEqual(1);
      expect(await card.evaluate(e => e.style.transform)).toMatch(/rotateY\(0(\.0+)?deg\)/);
      expect(await position(page)).toBe('0');
    });

    test('cards travel the study path, drawn in to 0.88 of its spread', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      // Card 2 waits at ty = 27% of the STUDY card height (35rem / 1.42 ≈ 394.4px)
      // and tx = 34·sin(55°) + 4 vw, both × 0.88.
      const t = await page.locator('#services-overview .sov-orbit-card').nth(1).evaluate(e => e.style.transform);
      const ty = parseFloat(/translateY\(([-\d.]+)px\)/.exec(t)[1]);
      const tx = parseFloat(/translateX\(([-\d.]+)vw\)/.exec(t)[1]);
      expect(Math.abs(ty - 0.27 * 394.37 * 0.88)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(tx - (34 * Math.sin(55 * Math.PI / 180) + 4) * 0.88)).toBeLessThanOrEqual(0.01);
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

    test('a trackpad swipe with its momentum tail turns exactly one card, without backing up', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      // Record card 1's rotateY every frame: along its path it only ever decreases.
      await page.evaluate(() => {
        window.__ry = [];
        const card = document.querySelector('#services-overview .sov-orbit-card');
        (function tick() {
          const m = /rotateY\(([-\d.]+)deg\)/.exec(card.style.transform);
          if (m) window.__ry.push(+m[1]);
          requestAnimationFrame(tick);
        })();
      });
      const deltas = [6, 14, 28, 42, 50, 46, 40];
      for (let d = 34; d > 1; d *= 0.9) deltas.push(Math.round(d)); // ~1 s momentum tail
      for (const d of deltas) { await page.mouse.wheel(0, d); await page.waitForTimeout(16); }
      await page.waitForTimeout(SETTLE_MS);
      expect(await position(page)).toBe('1');
      const ry = await page.evaluate(() => window.__ry);
      const backups = ry.slice(1).filter((v, i) => v - ry[i] > 0.05).length;
      expect(backups).toBe(0);
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
      // Card 1 streams from Bunny (HLS), so no MP4 of its own; card 2 warms up
      // its MP4; cards 3–5 load nothing yet. (hls.js may add its own blob:
      // <source>, so look for an actual .mp4, not just any src.)
      const mp4 = await page.locator('#services-overview .sov-orbit-card video').evaluateAll(vs => vs.map(v =>
        /\.mp4$/.test(v.getAttribute('src') || '') ||
        [...v.querySelectorAll('source')].some(s => /\.mp4$/.test(s.getAttribute('src') || ''))));
      const state = await page.locator('#services-overview .sov-orbit-card video').first().getAttribute('data-hls-state');
      expect(mp4, `Weddings stream state: ${state}`).toEqual([false, true, false, false, false]);
    });

    test('the Weddings card falls back to its MP4 if the stream fails', async ({ page }) => {
      await page.route('**/caaee9e1-dc0f-4aff-a41f-80eb9b0e6303/**', route => route.abort());
      await page.goto('/');
      await arrive(page);
      const video = page.locator('#services-overview .sov-orbit-card').first().locator('video');
      await expect.poll(() => video.getAttribute('data-hls-state'), { timeout: 20000 }).toMatch(/^fallback/);
      await expect.poll(() => video.evaluate(v => v.currentSrc), { timeout: 10000 }).toMatch(/wedding-showreel\.mp4$/);
    });

    test('the Weddings card streams its 4K reel from Bunny', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      const video = page.locator('#services-overview .sov-orbit-card').first().locator('video');
      await expect(video).toHaveAttribute('data-hls', /caaee9e1-dc0f-4aff-a41f-80eb9b0e6303\/playlist\.m3u8$/);
      // hls.js plays through a blob: MediaSource; Safari plays the .m3u8 natively.
      await expect.poll(() => video.evaluate(v => v.currentSrc), { timeout: 15000 })
        .toMatch(/^blob:|\.m3u8$/);
      await expect.poll(() => video.evaluate(v => v.readyState), { timeout: 15000 }).toBeGreaterThanOrEqual(2);
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

  test.describe('Services orbit — phone (the study\'s phone spiral)', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    test.beforeEach(async ({ page }) => { await page.addInitScript(skipIntro); });
    const rect = (page, sel) => page.locator(sel).first().evaluate(e => {
      const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    });
    const count = page => page.locator('#services-overview .sov-orbit-count');

    test('phone shows the orbit with its controls', async ({ page }) => {
      await page.goto('/');
      await expect(section(page)).toHaveClass(/sov-orbit-on/);
      await expect(section(page)).toHaveClass(/sov-orbit-phone/);
      await expect(page.locator('#services-overview .sov-grid')).toBeHidden();
      await expect(page.locator('#services-overview .sov-orbit-controls')).toBeVisible();
      await arrive(page);
      await expect(count(page)).toHaveText('01 / 05');
      await expect(page.locator('#services-overview .sov-orbit-prev')).toBeDisabled();
      const w = await page.locator('#services-overview .sov-orbit-card').first().evaluate(e => e.offsetWidth);
      expect(w).toBe(312); // min(80vw, 26rem), as on the study page
    });

    test('next and previous buttons turn one card', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      await page.locator('#services-overview .sov-orbit-next').click();
      await page.waitForTimeout(SETTLE_MS);
      expect(await position(page)).toBe('1');
      await expect(count(page)).toHaveText('02 / 05');
      await page.locator('#services-overview .sov-orbit-prev').click();
      await page.waitForTimeout(SETTLE_MS);
      expect(await position(page)).toBe('0');
    });

    test('only the front card shows its words', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      const words = await page.locator('#services-overview .sov-orbit-copy')
        .evaluateAll(els => els.map(e => Number(getComputedStyle(e).opacity)));
      expect(words[0]).toBe(1);
      expect(words[1]).toBe(0);
    });

    test('the front card sits close under the heading', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      const title = await rect(page, '#services-overview .sov-orbit-title');
      const card = await rect(page, '#services-overview .sov-orbit-card');
      const navBottom = await page.locator('#navbar').evaluate(n => n.getBoundingClientRect().bottom);
      expect(title.top).toBeGreaterThanOrEqual(navBottom);
      expect(card.top - title.bottom).toBeLessThanOrEqual(110);
      expect(card.top - title.bottom).toBeGreaterThanOrEqual(24);
    });

    test('the next card peeks out below the front card instead of covering it', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      const front = await rect(page, '#services-overview .sov-orbit-card:nth-child(1)');
      const next = await rect(page, '#services-overview .sov-orbit-card:nth-child(2)');
      expect(next.top).toBeGreaterThanOrEqual(front.bottom - 2);
    });

    test('a swipe up turns one card', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'touch is driven through the Chrome DevTools protocol');
      await page.goto('/');
      await arrive(page);
      const cdp = await page.context().newCDPSession(page);
      const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', {
        type, touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y }] });
      await touch('touchStart', 600);
      for (let y = 580; y >= 420; y -= 20) await touch('touchMove', y);
      await touch('touchEnd');
      await page.waitForTimeout(SETTLE_MS);
      expect(await position(page)).toBe('1');
    });

    test('back-to-top button stays off the Next button', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      await expect(page.locator('#backToTop')).toBeHidden();
      await expect(page.locator('#services-overview .sov-orbit-next')).toBeVisible();
    });

    test('no horizontal overflow on a phone', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });

  test.describe('Services orbit — landscape phone', () => {
    test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

    test('landscape phone shows the orbit', async ({ page }) => {
      await page.addInitScript(skipIntro);
      await page.goto('/');
      await expect(section(page)).toHaveClass(/sov-orbit-phone/);
      await arrive(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });

  test.describe('Services orbit — tablets keep the list', () => {
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
