// Shared test cases for the home-page services orbit (#services-overview).
// Desktop shows a copy of the first spiral on animation_spatial_gallery.html
// (same cards, size, paths and wheel behaviour); phones show a looping ring
// turned by sideways swipes; tablets keep the services list. Run per engine by services-spiral.spec.js (Chromium) and
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

    test('each film waits paused until its card reaches the front, then keeps playing', async ({ page }) => {
      test.setTimeout(60000);
      await page.goto('/');
      await arrive(page);
      const playing = () => page.locator('#services-overview .sov-orbit-card video')
        .evaluateAll(vs => vs.map(v => !v.paused));
      // Before they reach the front, cards 2–5 hold still.
      expect((await playing()).slice(1)).toEqual([false, false, false, false]);
      await wheel(page, 120);                                   // card 2 to the front
      await expect.poll(async () => (await playing())[1], { timeout: 8000 }).toBe(true);
      await wheel(page, 120);                                   // card 3 to the front
      await expect.poll(async () => (await playing())[2], { timeout: 8000 }).toBe(true);
      expect((await playing())[1]).toBe(true);                  // card 2 keeps playing past the centre
      expect((await playing()).slice(3)).toEqual([false, false]);
      await wheel(page, 120);
      await wheel(page, 120);                                   // all five have been in front
      await expect.poll(async () => (await playing())[4], { timeout: 8000 }).toBe(true);
      for (let i = 0; i < 4; i++) await wheel(page, -120);      // back to card 1
      expect(await position(page)).toBe('0');
      await expect.poll(async () => (await playing()).slice(1), { timeout: 8000 })
        .toEqual([true, true, true, true]);
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

  test.describe('Services orbit — phone (the ring)', () => {
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
      await expect(page.locator('#services-overview .sov-orbit-prev')).toBeEnabled(); // the ring loops
      const size = await page.locator('#services-overview .sov-orbit-card').first()
        .evaluate(e => ({ w: e.offsetWidth, h: e.offsetHeight }));
      expect(size.w).toBe(187); // min(48vw, 15rem): about half the screen, so the cards either side show
      expect(size.h).toBeGreaterThan(size.w); // portrait cards
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
      expect(card.top - title.bottom).toBeLessThanOrEqual(140);
      expect(card.top - title.bottom).toBeGreaterThanOrEqual(24);
    });

    test('the front card faces you, centred, with a neighbour turned away on each side', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      await page.locator('#services-overview .sov-orbit-next').click(); // front = card 2, so both sides exist
      await page.waitForTimeout(SETTLE_MS);
      const boxes = await page.locator('#services-overview .sov-orbit-card').evaluateAll(els => els.map(e => {
        const r = e.getBoundingClientRect();
        return { cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, w: r.width, h: r.height, op: Number(getComputedStyle(e).opacity) };
      }));
      const vw = 390;
      expect(Math.abs(boxes[1].cx - vw / 2)).toBeLessThanOrEqual(4);
      expect(boxes[0].cx).toBeLessThan(boxes[1].cx - 40);        // previous card off to the left
      expect(boxes[2].cx).toBeGreaterThan(boxes[1].cx + 40);     // next card off to the right
      // Beside the front card, a step up or down — not stacked clear above or below it.
      expect(Math.abs(boxes[0].cy - boxes[1].cy)).toBeLessThan(boxes[1].h * 0.75);
      expect(Math.abs(boxes[2].cy - boxes[1].cy)).toBeLessThan(boxes[1].h * 0.75);
      expect(boxes[0].w).toBeLessThan(boxes[1].w);               // turned away = foreshortened
      expect(boxes[2].w).toBeLessThan(boxes[1].w);
      expect(boxes[0].op).toBeGreaterThanOrEqual(0.35);
      expect(boxes[2].op).toBeGreaterThanOrEqual(0.35);
    });

    test('the ring loops: Previous from card 1 goes to card 5, Next brings it back', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      await page.locator('#services-overview .sov-orbit-prev').click();
      await page.waitForTimeout(SETTLE_MS);
      expect(await position(page)).toBe('4');
      await expect(count(page)).toHaveText('05 / 05');
      await page.locator('#services-overview .sov-orbit-next').click();
      await page.waitForTimeout(SETTLE_MS);
      expect(await position(page)).toBe('0');
    });

    test('the far side of the ring shows the backs of its cards, faded', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      const far = await page.locator('#services-overview .sov-orbit-card').nth(2).evaluate(e => ({
        op: Number(getComputedStyle(e).opacity), back: getComputedStyle(e).backfaceVisibility }));
      expect(far.back).toBe('visible');
      expect(far.op).toBeGreaterThan(0);
      expect(far.op).toBeLessThan(0.5);
    });

    test('the mouse wheel never turns the ring', async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'mobile WebKit has no mouse wheel');
      await page.goto('/');
      await arrive(page);
      await page.mouse.move(195, 500);
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(SETTLE_MS);
      expect(await position(page)).toBe('0');
    });

    test('rotating the phone keeps the current card', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      await page.locator('#services-overview .sov-orbit-next').click();
      await page.waitForTimeout(SETTLE_MS);
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(600);
      await expect(section(page)).toHaveClass(/sov-orbit-phone/);
      expect(await position(page)).toBe('1');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(600);
      expect(await position(page)).toBe('1');
    });

    // Touch is driven through the Chrome DevTools protocol, so these run in Chromium only.
    async function swipe(page, from, to, steps = 8) {
      const cdp = await page.context().newCDPSession(page);
      const send = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [p] : [] });
      await send('touchStart', { x: from.x, y: from.y });
      for (let i = 1; i <= steps; i++) await send('touchMove', {
        x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps });
      await send('touchEnd');
      await page.waitForTimeout(SETTLE_MS);
    }
    const LEFT = [{ x: 320, y: 500 }, { x: 60, y: 500 }];
    const RIGHT = [{ x: 60, y: 500 }, { x: 320, y: 500 }];
    const cdpOnly = browserName => test.skip(browserName !== 'chromium', 'touch is driven through the Chrome DevTools protocol');

    test('a swipe left turns exactly one card', async ({ page, browserName }) => {
      cdpOnly(browserName);
      await page.goto('/');
      await arrive(page);
      await swipe(page, ...LEFT);
      expect(await position(page)).toBe('1');
      await swipe(page, { x: 370, y: 500 }, { x: 10, y: 500 }); // a long swipe still turns only one
      expect(await position(page)).toBe('2');
    });

    test('a swipe right goes back one card', async ({ page, browserName }) => {
      cdpOnly(browserName);
      await page.goto('/');
      await arrive(page);
      await swipe(page, ...LEFT);
      expect(await position(page)).toBe('1');
      await swipe(page, ...RIGHT);
      expect(await position(page)).toBe('0');
    });

    test('a vertical swipe scrolls the page and never turns the ring', async ({ page, browserName }) => {
      cdpOnly(browserName);
      await page.goto('/');
      await arrive(page);
      const before = await scrollY(page);
      await swipe(page, { x: 195, y: 650 }, { x: 195, y: 250 });
      expect(await position(page)).toBe('0');
      expect(await scrollY(page)).toBeGreaterThanOrEqual(before + 100);
    });

    test('a diagonal swipe scrolls the page', async ({ page, browserName }) => {
      cdpOnly(browserName);
      await page.goto('/');
      await arrive(page);
      const before = await scrollY(page);
      await swipe(page, { x: 260, y: 650 }, { x: 120, y: 380 });
      expect(await position(page)).toBe('0');
      expect(await scrollY(page)).toBeGreaterThan(before);
    });

    // Only a clearly sideways swipe turns the ring. (A swipe that starts more
    // sideways than vertical doesn't scroll the page either: touch-action pan-y
    // locks it out of panning — browser behaviour, not ours.)
    test('a near-45° swipe does not turn the ring', async ({ page, browserName }) => {
      cdpOnly(browserName);
      await page.goto('/');
      await arrive(page);
      await swipe(page, { x: 300, y: 650 }, { x: 60, y: 450 }); // a little more sideways than vertical
      expect(await position(page)).toBe('0');
    });

    test('pinch-zoom still works over the ring', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      const ta = await section(page).evaluate(s => getComputedStyle(s).touchAction);
      expect(ta).toContain('pan-y');
      expect(ta).toContain('pinch-zoom');
    });

    test('a sideways swipe turns the ring even when the section is not lined up with the top', async ({ page, browserName }) => {
      cdpOnly(browserName);
      await page.goto('/');
      await arrive(page);
      await jump(page, (await sectionTop(page)) - Math.round(844 * 0.35));
      await page.waitForTimeout(400);
      const card = await page.locator('#services-overview .sov-orbit-card').first().evaluate(e => {
        const r = e.getBoundingClientRect(); return { y: Math.round((r.top + r.bottom) / 2) };
      });
      expect(card.y).toBeLessThan(844);
      await swipe(page, { x: 320, y: card.y }, { x: 60, y: card.y });
      expect(await position(page)).toBe('1');
    });

    test('swiping keeps going round: right from card 1 goes to card 5, left from card 5 to card 1', async ({ page, browserName }) => {
      cdpOnly(browserName);
      await page.goto('/');
      await arrive(page);
      await swipe(page, ...RIGHT);
      expect(await position(page)).toBe('4');
      await swipe(page, ...LEFT);
      expect(await position(page)).toBe('0');
    });

    test('after a swipe only the new front card plays', async ({ page, browserName }) => {
      cdpOnly(browserName);
      await page.goto('/');
      await arrive(page);
      await swipe(page, ...LEFT);
      const videos = page.locator('#services-overview .sov-orbit-video');
      await expect.poll(() => videos.nth(1).evaluate(v => v.paused), { timeout: 8000 }).toBe(false);
      const paused = await videos.evaluateAll(vs => vs.map(v => v.paused));
      paused.forEach((p, i) => { if (i !== 1) expect(p).toBe(true); });
    });

    test('the hint says to swipe sideways', async ({ page }) => {
      await page.goto('/');
      await arrive(page);
      const hint = page.locator('#services-overview .sov-orbit-gesture');
      await expect(hint).toHaveText('Swipe to explore');
      for (let i = 0; i < 4; i++) {
        await page.locator('#services-overview .sov-orbit-next').click();
        await page.waitForTimeout(SETTLE_MS);
      }
      await expect(hint).toHaveText('Swipe to explore'); // the ring has no last card
    });

    test('the ring turns into place as the cards fade in, then rests on card 1', async ({ page }) => {
      await page.goto('/');
      const peak = page.evaluate(() => new Promise(resolve => {
        let max = 0;
        const card = document.querySelectorAll('#services-overview .sov-orbit-card')[0];
        const t0 = performance.now();
        (function tick() {
          const t = getComputedStyle(card).transform;
          if (t && t !== 'none') max = Math.max(max, Math.abs(new DOMMatrix(t).m41));
          performance.now() - t0 < 4500 ? requestAnimationFrame(tick) : resolve(max);
        })();
      }));
      await jump(page, await sectionTop(page));
      expect(await peak).toBeGreaterThan(20);              // card 1 came in from the side
      await page.waitForTimeout(400);
      expect(await position(page)).toBe('0');
      const x = await page.locator('#services-overview .sov-orbit-card').first()
        .evaluate(e => Math.abs(new DOMMatrix(getComputedStyle(e).transform).m41));
      expect(x).toBeLessThan(1);                           // and rests square-on
    });

    test('the ring turns itself on to the next card after a few seconds, and keeps looping', async ({ page }) => {
      test.setTimeout(45000);
      await page.goto('/');
      await arrive(page);
      expect(await position(page)).toBe('0');
      await page.waitForTimeout(3000);
      expect(await position(page)).toBe('0');                  // holds the card while its film plays
      await expect.poll(() => position(page), { timeout: 9000 }).toBe('1');
      await expect.poll(() => position(page), { timeout: 9000 }).toBe('2');
    });

    test('after a tap it waits before turning itself again', async ({ page }) => {
      test.setTimeout(45000);
      await page.goto('/');
      await arrive(page);
      await page.waitForTimeout(4000);
      await page.locator('#services-overview .sov-orbit-next').click();
      await page.waitForTimeout(SETTLE_MS);
      expect(await position(page)).toBe('1');
      await page.waitForTimeout(5500);                         // past the normal hold, inside the wait
      expect(await position(page)).toBe('1');
      await expect.poll(() => position(page), { timeout: 6000 }).toBe('2');
    });

    test('reduced motion: never turns itself, and Next jumps straight to the card', async ({ page }) => {
      test.setTimeout(45000);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      await arrive(page);
      await page.waitForTimeout(9000);
      expect(await position(page)).toBe('0');
      await page.locator('#services-overview .sov-orbit-next').click();
      await page.waitForTimeout(120);
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
