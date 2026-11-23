// Motion quality of the two spirals on animation_spatial_gallery.html.
//
// Most tests freeze the page clock (page.clock) and step it one 16 ms frame at a
// time, so they measure exactly what each rendered frame shows: the projected
// screen position of a card (getBoundingClientRect), its transform, and which
// card is on top where two overlap. Videos are blocked so frames are static.
//
// Run on its own:  npx playwright test spatial-gallery-motion.spec.js --reporter=line --workers=1
const { test, expect } = require('@playwright/test');

const PAGE = '/animation_spatial_gallery.html';
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const FRAME = 16;
const S1 = '#helixField .gallery-card';
const S2 = '#helixField2 .gallery-card';

async function open(page, { clock = true } = {}) {
  await page.route('**/*.mp4', route => route.abort());
  if (clock) {
    // install() alone lets time keep flowing in real time; pausing makes every
    // frame advance only through runFor(), so results don't depend on test speed.
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  }
  await page.goto(PAGE);
  // IntersectionObserver callbacks arrive with real rendering frames, not the
  // paused page clock, so give the page a moment of real time first.
  await page.waitForTimeout(200);
  if (clock) await page.clock.runFor(2500); // finish the entry fade
  else await page.waitForTimeout(2500);
}

const centers = (page, selector) => page.evaluate(sel =>
  [...document.querySelectorAll(sel)].map(card => {
    const r = card.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }), selector);

const transforms = (page, selector) => page.evaluate(sel =>
  [...document.querySelectorAll(sel)].map(card => card.style.transform), selector);

// Screen distance a card travels on each of the next `count` frames.
async function framePath(page, selector, index, count) {
  let previous = (await centers(page, selector))[index];
  const steps = [];
  for (let i = 0; i < count; i++) {
    await page.clock.runFor(FRAME);
    const now = (await centers(page, selector))[index];
    steps.push(Math.hypot(now.x - previous.x, now.y - previous.y));
    previous = now;
  }
  return steps;
}

// Index of the card resting exactly in the featured slot, or -1 when the
// spiral is parked between cards.
async function featuredCard(page, selector, featuredTransform) {
  return (await transforms(page, selector)).indexOf(featuredTransform);
}

async function wheel(page, deltas) {
  await page.mouse.move(720, 450);
  for (const dy of deltas) {
    await page.mouse.wheel(0, dy);
    await page.clock.runFor(FRAME);
  }
}

async function showServices(page) {
  await page.evaluate(() => document.getElementById('studyServices').scrollIntoView());
  await page.waitForTimeout(200); // real time, so the in-view observer fires
  await page.clock.runFor(3500); // lazy boot + entry fade of the second spiral
}

test.describe('spiral motion: starts without a jolt', () => {
  test('desktop wheel: first frame moves gently, not at full speed', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page);
    await wheel(page, []);
    await page.mouse.wheel(0, 200);
    const steps = await framePath(page, S1, 1, 45);
    expect(steps[0] / Math.max(...steps)).toBeLessThan(0.45);
  });

  test('phone Next button: first frame moves gently, not at full speed', async ({ browser }) => {
    const context = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await open(page);
    await page.click('#galleryNext');
    const steps = await framePath(page, S1, 1, 45);
    expect(steps[0] / Math.max(...steps)).toBeLessThan(0.45);
    await context.close();
  });

  test('services spiral: first frame moves gently, not at full speed', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page);
    await showServices(page);
    await wheel(page, []);
    await page.mouse.wheel(0, 200);
    const steps = await framePath(page, S2, 1, 45);
    expect(steps[0] / Math.max(...steps)).toBeLessThan(0.45);
  });
});

test.describe('spiral motion: always comes to rest on a card', () => {
  const cases = [
    { name: 'a small accidental nudge returns to the current card', deltas: [20], card: 0 },
    { name: 'a deliberate partial scroll advances one card', deltas: [74], card: 1 },
    { name: 'one mouse-wheel notch advances one card', deltas: [100], card: 1 },
    { name: 'a long trackpad stream lands on the nearest card (1.35 cards)', deltas: Array(15).fill(18), card: 1 },
    { name: 'a long trackpad stream lands on the nearest card (1.6 cards)', deltas: Array(16).fill(20), card: 2 },
    { name: 'scrolling back part-way returns one card', deltas: [200, null, -60], card: 0 },
  ];
  for (const c of cases) {
    test(`gallery: ${c.name}`, async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await open(page);
      const featured = (await transforms(page, S1))[0];
      for (const dy of c.deltas) {
        if (dy === null) await page.clock.runFor(1500); // let the first gesture settle
        else await wheel(page, [dy]);
      }
      await page.clock.runFor(1500);
      expect(await featuredCard(page, S1, featured)).toBe(c.card);
    });
  }

  test('services: one mouse-wheel notch advances one card and rests on it', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page);
    await showServices(page);
    const featured = (await transforms(page, S2))[0];
    await wheel(page, [100]);
    await page.clock.runFor(1500);
    expect(await featuredCard(page, S2, featured)).toBe(1);
  });
});

test.describe('spiral motion: settles crisply', () => {
  test('a one-card move is completely still within 1 second (no creeping tail)', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page);
    const featured = (await transforms(page, S1))[0];
    await wheel(page, [200]);
    await page.clock.runFor(1000);
    const atOneSecond = await transforms(page, S1);
    await page.clock.runFor(500);
    expect(await transforms(page, S1)).toEqual(atOneSecond);
    expect(atOneSecond[1]).toBe(featured);
  });

  test('no animation frames are requested while both spirals are at rest', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page);
    await showServices(page);
    await page.clock.runFor(2000);
    await page.evaluate(() => {
      window.__frames = 0;
      const request = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => request(time => { window.__frames++; callback(time); });
    });
    await page.clock.runFor(1000);
    expect(await page.evaluate(() => window.__frames)).toBe(0);
  });
});

test.describe('spiral motion: finger hand-off (phone)', () => {
  test('lifting the finger mid-swipe continues at the finger speed (no lurch)', async ({ browser }) => {
    const context = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await open(page);
    const cdp = await context.newCDPSession(page);
    const ys = [(await centers(page, S1))[1].y];
    let y = 600;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y }] });
    for (let i = 0; i < 40; i++) {
      y -= 4;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y }] });
      await page.clock.runFor(FRAME);
      ys.push((await centers(page, S1))[1].y);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    for (let i = 0; i < 2; i++) {
      await page.clock.runFor(FRAME);
      ys.push((await centers(page, S1))[1].y);
    }
    const speeds = ys.slice(1).map((value, i) => Math.abs(value - ys[i]));
    const fingerSpeed = speeds.slice(35, 40).reduce((sum, v) => sum + v, 0) / 5;
    // Speed at the instant of lift, extrapolated from the first two frames after
    // it. A settle animation may then accelerate; a lurch is a jump at the lift.
    const [first, second] = speeds.slice(40, 42);
    const atLift = (3 * first - second) / 2;
    expect(atLift / fingerSpeed).toBeGreaterThan(0.6);
    expect(atLift / fingerSpeed).toBeLessThan(1.5);
    await context.close();
  });
});

test.describe('spiral motion: overlapping cards never pop (phone)', () => {
  test('the card in front changes gradually where cards overlap, never all at once', async ({ browser }) => {
    const context = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await open(page);
    // Hit testing follows paint order; enable it on the cards for measurement only.
    await page.addStyleTag({ content: '.gallery-stage, .gallery-stage * { pointer-events: auto !important; }' });

    // For each adjacent pair that overlaps, which of the two is on top across a
    // 7×7 grid of points inside their overlap.
    const topGrid = () => page.evaluate(sel => {
      const cards = [...document.querySelectorAll(sel)];
      const out = {};
      for (let i = 0; i < cards.length - 1; i++) {
        const a = cards[i], b = cards[i + 1];
        if (+a.style.opacity < 0.05 || +b.style.opacity < 0.05) continue;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const left = Math.max(ra.left, rb.left) + 3, right = Math.min(ra.right, rb.right) - 3;
        const top = Math.max(ra.top, rb.top) + 3, bottom = Math.min(ra.bottom, rb.bottom) - 3;
        if (right <= left || bottom <= top) continue;
        if ((right - left) * (bottom - top) < 0.03 * Math.min(ra.width * ra.height, rb.width * rb.height)) continue;
        const grid = [];
        for (let gx = 0; gx < 7; gx++) for (let gy = 0; gy < 7; gy++) {
          const hit = document.elementFromPoint(left + (right - left) * gx / 6, top + (bottom - top) * gy / 6);
          const card = hit && hit.closest('.gallery-card');
          grid.push(card === a ? i : card === b ? i + 1 : -1);
        }
        out[i] = grid;
      }
      return out;
    }, S1);

    let worst = 0;
    for (let step = 0; step < 4; step++) {
      await page.click('#galleryNext');
      let previous = await topGrid();
      for (let f = 0; f < 50; f++) {
        await page.clock.runFor(FRAME);
        const now = await topGrid();
        for (const pair of Object.keys(now)) {
          if (!previous[pair]) continue;
          let compared = 0, flipped = 0;
          now[pair].forEach((card, k) => {
            const before = previous[pair][k];
            if (card < 0 || before < 0) return;
            compared++;
            if (card !== before) flipped++;
          });
          if (compared >= 10) worst = Math.max(worst, flipped / compared);
        }
        previous = now;
      }
    }
    expect(worst).toBeLessThan(0.6);
    await context.close();
  });
});

test.describe('spiral motion: section is in place before the spiral turns', () => {
  test('scrolling back up into the gallery aligns it before the cards move', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page, { clock: false });
    await page.mouse.move(720, 450);
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 200); await page.waitForTimeout(1300); }
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 150); await page.waitForTimeout(120); }
    await page.waitForTimeout(900);
    let topWhenTurning = null;
    for (let i = 0; i < 40 && topWhenTurning === null; i++) {
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(140);
      const state = await page.evaluate(() => ({
        card: document.getElementById('galleryCount').textContent.slice(0, 2),
        top: document.querySelector('.study--gallery').getBoundingClientRect().top,
      }));
      if (state.card !== '05') topWhenTurning = state.top;
    }
    expect(topWhenTurning).not.toBeNull();
    expect(Math.abs(topWhenTurning)).toBeLessThanOrEqual(2);
  });

  test('scrolling down into services aligns it before its cards move', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page, { clock: false });
    await page.mouse.move(720, 450);
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 200); await page.waitForTimeout(1300); }
    let topWhenTurning = null;
    for (let i = 0; i < 60 && topWhenTurning === null; i++) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(140);
      const state = await page.evaluate(() => ({
        card: document.getElementById('svcCounter').textContent,
        top: document.getElementById('studyServices').getBoundingClientRect().top,
      }));
      if (state.card !== '01') topWhenTurning = state.top;
    }
    expect(topWhenTurning).not.toBeNull();
    expect(Math.abs(topWhenTurning)).toBeLessThanOrEqual(2);
  });
});
