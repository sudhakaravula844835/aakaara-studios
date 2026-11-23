// Mobile presentation of animation_spatial_gallery.html (phone portrait and
// landscape). Measures what a phone visitor sees: which card shows its words,
// how cards meet the edges of the gallery, layout, text size, and which
// videos keep playing.
//
// Run on its own:  npx playwright test spatial-gallery-mobile.spec.js --reporter=line --workers=1
const { test, expect } = require('@playwright/test');
const { PNG } = require('playwright-core/lib/utilsBundle');

const PAGE = '/animation_spatial_gallery.html';
const PHONE = { viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true };
const PHONE_LANDSCAPE = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };

async function phonePage(browser, options = PHONE, { videos = false } = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  if (!videos) await page.route('**/*.mp4', route => route.abort());
  await page.goto(PAGE);
  await page.waitForTimeout(2600); // entry fade
  return { context, page };
}

async function next(page, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.click('#galleryNext');
    await page.waitForTimeout(1100);
  }
}

test('phone: only the card in focus shows its title and meaning', async ({ browser }) => {
  const { context, page } = await phonePage(browser);
  const copyOpacity = () => page.evaluate(() =>
    [...document.querySelectorAll('#helixField .gallery-card__copy')]
      .map(copy => +getComputedStyle(copy).opacity));
  for (const focus of [0, 2]) {
    if (focus) await next(page, focus);
    const opacity = await copyOpacity();
    opacity.forEach((value, i) => {
      if (i === focus) expect(value, `card ${i + 1} (in focus)`).toBeGreaterThan(0.95);
      else expect(value, `card ${i + 1} (not in focus)`).toBeLessThan(0.05);
    });
  }
  await context.close();
});

test('phone: cards fade out at the top and bottom of the gallery instead of being sliced', async ({ browser }) => {
  const { context, page } = await phonePage(browser);
  await next(page); // card 2: card 1 recedes over the top edge, card 3 waits below
  const edges = await page.evaluate(() => {
    const stage = document.querySelector('.study--gallery .gallery-stage').getBoundingClientRect();
    const cards = [...document.querySelectorAll('#helixField .gallery-card')]
      .filter(card => +card.style.opacity > 0.3)
      .map(card => card.getBoundingClientRect());
    return {
      top: Math.ceil(stage.top), bottom: Math.floor(stage.bottom), left: stage.left, width: stage.width,
      crossesTop: cards.some(r => r.top < stage.top && r.bottom > stage.top),
      crossesBottom: cards.some(r => r.top < stage.bottom && r.bottom > stage.bottom),
    };
  });
  expect(edges.crossesTop, 'a card reaches past the top edge (test precondition)').toBe(true);
  const brightest = async y => {
    const png = PNG.sync.read(await page.screenshot({
      clip: { x: edges.left, y, width: edges.width, height: 2 },
    }));
    let max = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      max = Math.max(max, (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3);
    }
    return max;
  };
  expect(await brightest(edges.top + 1), 'top edge of the gallery').toBeLessThan(40);
  if (edges.crossesBottom) {
    expect(await brightest(edges.bottom - 3), 'bottom edge of the gallery').toBeLessThan(40);
  }
  await context.close();
});

test('phone landscape: the heading sits beside the spiral, not above it', async ({ browser }) => {
  const { context, page } = await phonePage(browser, PHONE_LANDSCAPE);
  const layout = await page.evaluate(() => {
    const rect = el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
    return {
      heading: rect(document.querySelector('.study--gallery .study-head h1')),
      card: rect(document.querySelector('#helixField .gallery-card')),
      controls: rect(document.querySelector('.gallery-controls')),
      height: innerHeight,
    };
  });
  expect(layout.heading.right).toBeLessThanOrEqual(layout.card.left + 1);
  expect(layout.heading.top).toBeLessThan(layout.card.bottom);
  expect(layout.heading.bottom).toBeGreaterThan(layout.card.top);
  expect(layout.card.top).toBeGreaterThanOrEqual(0);
  expect(layout.card.bottom).toBeLessThanOrEqual(layout.height);
  const touchesControls = layout.card.left < layout.controls.right && layout.card.right > layout.controls.left &&
    layout.card.top < layout.controls.bottom && layout.card.bottom > layout.controls.top;
  expect(touchesControls, 'card overlaps the controls').toBe(false);
  await context.close();
});

test('phone: the services list stays compact (under 2.7 screens)', async ({ browser }) => {
  const { context, page } = await phonePage(browser);
  const screens = await page.evaluate(() =>
    document.getElementById('studyServices').getBoundingClientRect().height / innerHeight);
  expect(screens).toBeLessThan(2.7);
  await context.close();
});

test('phone: no visible text is smaller than 11px', async ({ browser }) => {
  const { context, page } = await phonePage(browser);
  const tooSmall = await page.evaluate(() => [...document.querySelectorAll('body *')]
    .filter(el => !el.closest('svg') && el.offsetParent !== null &&
      [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
    .map(el => [el.className || el.tagName, el.textContent.trim().slice(0, 24), parseFloat(getComputedStyle(el).fontSize)])
    .filter(([, , size]) => size < 11));
  expect(tooSmall).toEqual([]);
  await context.close();
});

test('phone: cards faded fully out of view stop playing and resume when they return', async ({ browser }) => {
  const { context, page } = await phonePage(browser, PHONE, { videos: true });
  const playing = () => page.evaluate(() => new Promise(resolve => {
    const videos = [...document.querySelectorAll('#helixField video')];
    const before = videos.map(v => v.currentTime);
    setTimeout(() => resolve(videos.map((v, i) => v.currentTime > before[i])), 800);
  }));
  await next(page, 4); // card 5: cards 1 and 2 have receded out of view
  expect(await playing()).toEqual([false, false, true, true, true]);
  await page.click('#galleryPrevious'); await page.waitForTimeout(1100);
  await page.click('#galleryPrevious'); await page.waitForTimeout(1600); // card 3: all five visible again
  expect(await playing()).toEqual([true, true, true, true, true]);
  await context.close();
});
