// Kind Words (#testimonials): what a visitor sees as they scroll through it.
// Desktop floats four quote cards past a "Book a Session" button; narrower
// screens swipe through them; reduced motion shows all four, still.
//
// Run on its own:  npx playwright test kind-words.spec.js --reporter=line --workers=1
const { test, expect } = require('@playwright/test');

async function open(browser, options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.addInitScript(() => sessionStorage.setItem('skipIntro', '1'));
  await page.goto('/');
  await page.waitForTimeout(1500);
  return { context, page };
}

// The page scrolls smoothly (scroll-behavior: smooth), so tests jump instead.
const jumpTo = (page, y) => page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), Math.round(y));
const jumpToCenter = (page, selector) => page.evaluate(sel => {
  const r = document.querySelector(sel).getBoundingClientRect();
  window.scrollTo({ top: scrollY + r.top + r.height / 2 - innerHeight / 2, behavior: 'instant' });
}, selector);

const sectionGeometry = page => page.evaluate(() => {
  const w = document.querySelector('.lab-testimonial-wrapper');
  return { top: w.getBoundingClientRect().top + scrollY, vh: innerHeight };
});

// Area of the button hidden by cards that are visible enough to read (px²).
const buttonCovered = page => page.evaluate(() => {
  const b = document.querySelector('.lab-testimonial-cta').getBoundingClientRect();
  let worst = 0;
  document.querySelectorAll('.lab-quote-card').forEach(card => {
    if (+getComputedStyle(card).opacity < 0.15) return;
    const r = card.getBoundingClientRect();
    const ox = Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left));
    const oy = Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top));
    worst = Math.max(worst, ox * oy);
  });
  return worst;
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }]) {
  test(`desktop ${viewport.width}: no quote card passes under the Book a Session button`, async ({ browser }) => {
    const { context, page } = await open(browser, { viewport });
    const { top, vh } = await sectionGeometry(page);
    for (let step = 0; step <= 3.5; step += 0.25) {
      await jumpTo(page, top + step * vh);
      await page.waitForTimeout(700); // cards glide to a new scroll position over 0.45s
      expect(await buttonCovered(page), `scrolled ${step} screens in`).toBe(0);
    }
    await context.close();
  });
}

test('reduced motion: all four quotes are on screen together, and the section is not a long scroll', async ({ browser }) => {
  const { context, page } = await open(browser, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const height = await page.evaluate(() => document.getElementById('testimonials').offsetHeight);
  expect(height).toBeLessThan(900 * 1.6);
  await jumpToCenter(page, '.lab-testimonial-track');
  await page.waitForTimeout(400);
  const cards = await page.evaluate(() => [...document.querySelectorAll('.lab-quote-card')].map(c => {
    const r = c.getBoundingClientRect();
    return { inView: r.top >= 0 && r.bottom <= innerHeight, opacity: +getComputedStyle(c).opacity };
  }));
  expect(cards).toEqual(Array(4).fill({ inView: true, opacity: 1 }));
  await context.close();
});

for (const [name, options] of [
  ['desktop', { viewport: { width: 1440, height: 900 } }],
  ['tablet', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true }],
  ['phone', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true }],
]) {
  test(`${name}: the line under each name is readable and clear of the seal`, async ({ browser }) => {
    const { context, page } = await open(browser, options);
    await jumpToCenter(page, '.lab-testimonial-track');
    await page.waitForTimeout(800);
    const cards = await page.evaluate(() => [...document.querySelectorAll('.lab-quote-card')].map(c => {
      const line = c.querySelector('.lab-quote-meta span'), name = c.querySelector('.lab-quote-meta strong');
      const seal = c.querySelector('.lab-quote-seal').getBoundingClientRect();
      const clear = el => el.getBoundingClientRect().right <= seal.left + 0.5;
      return {
        fontPx: parseFloat(getComputedStyle(line).fontSize),
        alpha: +(getComputedStyle(line).color.match(/[\d.]+(?=\))/) || [1])[0],
        lineClear: clear(line) && line.scrollWidth <= line.clientWidth + 1,
        nameClear: clear(name) && name.scrollWidth <= name.clientWidth + 1,
      };
    }));
    for (const c of cards) {
      expect(c.fontPx).toBeGreaterThanOrEqual(11);
      expect(c.alpha).toBeGreaterThanOrEqual(0.6);
      expect(c.lineClear).toBe(true);
      expect(c.nameClear).toBe(true);
    }
    await context.close();
  });
}

test('desktop: the cards stop animating while the section is off screen', async ({ browser }) => {
  const { context, page } = await open(browser, { viewport: { width: 1440, height: 900 } });
  const writes = await page.evaluate(() => new Promise(resolve => {
    let n = 0;
    const mo = new MutationObserver(m => { n += m.length; });
    document.querySelectorAll('.lab-quote-card').forEach(c => mo.observe(c, { attributes: true }));
    setTimeout(() => { mo.disconnect(); resolve(n); }, 1000);
  }));
  expect(writes).toBe(0);
  await context.close();
});

test('tablet portrait: swiping moves the counter on to the next quote', async ({ browser }) => {
  const { context, page } = await open(browser, { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true });
  await jumpToCenter(page, '.lab-testimonial-track');
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const t = document.querySelector('.lab-testimonial-track'), c = t.querySelectorAll('.lab-quote-card')[1];
    t.scrollTo({ left: c.offsetLeft - (t.clientWidth - c.offsetWidth) / 2 });
  });
  await page.waitForTimeout(900);
  await expect(page.locator('[data-testimonial-mobile-current]')).toHaveText('02');
  await context.close();
});
