import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const scriptContent = fs.readFileSync(path.resolve(__dirname, './Script.js'), 'utf8');

// Extract EtherealCarousel class by bracketing known file markers
const classStart = scriptContent.indexOf('class EtherealCarousel {');
const classEnd = scriptContent.indexOf('// Lazy-load helper', classStart);
const carouselClassSrc = scriptContent.slice(classStart, classEnd).trimEnd();

function makeDOM(itemCount = 4) {
  const itemsHtml = Array.from({ length: itemCount }, (_, i) =>
    `<div class="ec-item">Item ${i}</div>`
  ).join('');

  const dom = new JSDOM(
    `<!DOCTYPE html><html><body>
      <div class="ethereal-carousel" id="c">
        <div class="ec-track">${itemsHtml}</div>
        <button class="ec-prev"></button>
        <button class="ec-next"></button>
        <span class="ec-counter-current"></span>
        <span class="ec-counter-total"></span>
      </div>
    </body></html>`,
    {
      runScripts: 'dangerously',
      beforeParse(win) {
        win.matchMedia = () => ({
          matches: false,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
        });
        win.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
        win.cancelAnimationFrame = (id) => clearTimeout(id);
      },
    }
  );

  // Inject class and expose it on window so tests can instantiate it
  const script = dom.window.document.createElement('script');
  script.textContent = carouselClassSrc + '\nwindow.EtherealCarousel = EtherealCarousel;';
  dom.window.document.head.appendChild(script);

  return dom;
}

function makeCarousel(dom) {
  const { window } = dom;
  const container = window.document.getElementById('c');
  const carousel = new window.EtherealCarousel(container, {
    itemSelector: '.ec-item',
    lazyLoadFn: null,
  });
  carousel.rebuild();
  return carousel;
}

// ─── rebuild() ───────────────────────────────────────────────────────────────

describe('EtherealCarousel — rebuild', () => {
  it('collects all visible items', () => {
    const dom = makeDOM(4);
    const c = makeCarousel(dom);
    expect(c.filteredItems).toHaveLength(4);
  });

  it('excludes items hidden via display:none', () => {
    const dom = makeDOM(4);
    dom.window.document.querySelectorAll('.ec-item')[1].style.display = 'none';
    const c = makeCarousel(dom);
    expect(c.filteredItems).toHaveLength(3);
  });

  it('clamps currentIndex when filtered count drops below it', () => {
    const dom = makeDOM(4);
    const c = makeCarousel(dom);
    c.goTo(3);
    // Hide the last two items so only 2 remain
    [...dom.window.document.querySelectorAll('.ec-item')].slice(2).forEach(el => {
      el.style.display = 'none';
    });
    c.rebuild();
    expect(c.currentIndex).toBe(1); // clamped to new last index
  });

  it('keeps index at 0 when empty after rebuild', () => {
    const dom = makeDOM(3);
    const c = makeCarousel(dom);
    dom.window.document.querySelectorAll('.ec-item').forEach(el => {
      el.style.display = 'none';
    });
    c.rebuild();
    expect(c.currentIndex).toBe(0);
    expect(c.filteredItems).toHaveLength(0);
  });
});

// ─── navigate() ──────────────────────────────────────────────────────────────

describe('EtherealCarousel — navigate', () => {
  let dom, carousel;

  beforeEach(() => {
    dom = makeDOM(4);
    carousel = makeCarousel(dom);
  });

  it('increments index on navigate(1)', () => {
    carousel.navigate(1);
    expect(carousel.currentIndex).toBe(1);
  });

  it('does not decrement below 0', () => {
    carousel.navigate(-1);
    expect(carousel.currentIndex).toBe(0);
  });

  it('does not exceed last index', () => {
    carousel.goTo(3);
    carousel.navigate(1);
    expect(carousel.currentIndex).toBe(3);
  });

  it('sets _blockNextCardClick flag when source is gesture', () => {
    carousel.navigate(1, 'gesture');
    expect(carousel._blockNextCardClick).toBe(true);
  });

  it('does not set _blockNextCardClick for programmatic source', () => {
    carousel.navigate(1, 'programmatic');
    expect(carousel._blockNextCardClick).toBe(false);
  });

  it('applies a longer suppression window for gesture vs programmatic', () => {
    const c1 = makeCarousel(makeDOM(4));
    const c2 = makeCarousel(makeDOM(4));
    c1.navigate(1, 'gesture');
    c2.navigate(1, 'programmatic');
    // Both should suppress clicks immediately after navigation
    expect(c1._shouldSuppressClick()).toBe(true);
    expect(c2._shouldSuppressClick()).toBe(true);
    // Gesture timeout (520ms) exceeds programmatic timeout (320ms)
    expect(c1._suppressClicksUntil).toBeGreaterThan(c2._suppressClicksUntil);
  });
});

// ─── goTo() ──────────────────────────────────────────────────────────────────

describe('EtherealCarousel — goTo', () => {
  let dom, carousel;

  beforeEach(() => {
    dom = makeDOM(4);
    carousel = makeCarousel(dom);
  });

  it('jumps to the requested index', () => {
    carousel.goTo(2);
    expect(carousel.currentIndex).toBe(2);
  });

  it('ignores negative out-of-bounds index', () => {
    carousel.goTo(-1);
    expect(carousel.currentIndex).toBe(0);
  });

  it('ignores positive out-of-bounds index', () => {
    carousel.goTo(10);
    expect(carousel.currentIndex).toBe(0);
  });

  it('goes to index 0 explicitly', () => {
    carousel.goTo(2);
    carousel.goTo(0);
    expect(carousel.currentIndex).toBe(0);
  });
});

// ─── render(): data-ec-offset assignments ────────────────────────────────────

describe('EtherealCarousel — render: data-ec-offset', () => {
  let dom, carousel, items;

  beforeEach(() => {
    dom = makeDOM(5);
    carousel = makeCarousel(dom);
    carousel.goTo(2); // center at index 2
    items = [...dom.window.document.querySelectorAll('.ec-item')];
  });

  it('sets "0" on the center item', () => {
    expect(items[2].getAttribute('data-ec-offset')).toBe('0');
  });

  it('sets "1" on the immediate right item', () => {
    expect(items[3].getAttribute('data-ec-offset')).toBe('1');
  });

  it('sets "-1" on the immediate left item', () => {
    expect(items[1].getAttribute('data-ec-offset')).toBe('-1');
  });

  it('sets "hidden" on far-right items', () => {
    expect(items[4].getAttribute('data-ec-offset')).toBe('hidden');
  });

  it('sets "hidden" on far-left items', () => {
    expect(items[0].getAttribute('data-ec-offset')).toBe('hidden');
  });

  it('re-assigns offsets correctly after navigate(1)', () => {
    carousel.navigate(1); // now center = index 3
    expect(items[3].getAttribute('data-ec-offset')).toBe('0');
    expect(items[4].getAttribute('data-ec-offset')).toBe('1');
    expect(items[2].getAttribute('data-ec-offset')).toBe('-1');
    expect(items[1].getAttribute('data-ec-offset')).toBe('hidden');
    expect(items[0].getAttribute('data-ec-offset')).toBe('hidden');
  });

  it('re-assigns offsets correctly after navigate(-1)', () => {
    carousel.navigate(-1); // now center = index 1
    expect(items[1].getAttribute('data-ec-offset')).toBe('0');
    expect(items[2].getAttribute('data-ec-offset')).toBe('1');
    expect(items[0].getAttribute('data-ec-offset')).toBe('-1');
    expect(items[3].getAttribute('data-ec-offset')).toBe('hidden');
    expect(items[4].getAttribute('data-ec-offset')).toBe('hidden');
  });

  it('center card has pointer-events auto, far cards have none', () => {
    expect(items[2].style.pointerEvents).toBe('auto');
    expect(items[0].style.pointerEvents).toBe('none');
    expect(items[4].style.pointerEvents).toBe('none');
  });
});

// ─── counter display ─────────────────────────────────────────────────────────

describe('EtherealCarousel — counter display', () => {
  let dom, carousel, counterCurrent, counterTotal;

  beforeEach(() => {
    dom = makeDOM(4);
    carousel = makeCarousel(dom);
    counterCurrent = dom.window.document.querySelector('.ec-counter-current');
    counterTotal = dom.window.document.querySelector('.ec-counter-total');
  });

  it('shows 1 and total count on initialisation', () => {
    expect(counterCurrent.textContent).toBe('1');
    expect(counterTotal.textContent).toBe('4');
  });

  it('increments current on navigate(1)', () => {
    carousel.navigate(1);
    expect(counterCurrent.textContent).toBe('2');
  });

  it('updates current on goTo', () => {
    carousel.goTo(3);
    expect(counterCurrent.textContent).toBe('4');
  });

  it('shows 0/0 when all items are hidden', () => {
    dom.window.document.querySelectorAll('.ec-item').forEach(el => {
      el.style.display = 'none';
    });
    carousel.rebuild();
    expect(counterCurrent.textContent).toBe('0');
    expect(counterTotal.textContent).toBe('0');
  });

  it('updates total after rebuild with fewer items', () => {
    dom.window.document.querySelectorAll('.ec-item')[3].style.display = 'none';
    carousel.rebuild();
    expect(counterTotal.textContent).toBe('3');
  });
});

// ─── nav button disabled states ──────────────────────────────────────────────

describe('EtherealCarousel — nav button states', () => {
  let dom, carousel, prevBtn, nextBtn;

  beforeEach(() => {
    dom = makeDOM(4);
    carousel = makeCarousel(dom);
    prevBtn = dom.window.document.querySelector('.ec-prev');
    nextBtn = dom.window.document.querySelector('.ec-next');
  });

  it('prev is disabled at index 0', () => {
    expect(prevBtn.classList.contains('ec-disabled')).toBe(true);
    expect(prevBtn.getAttribute('aria-disabled')).toBe('true');
  });

  it('next is enabled at index 0', () => {
    expect(nextBtn.classList.contains('ec-disabled')).toBe(false);
    expect(nextBtn.getAttribute('aria-disabled')).toBe('false');
  });

  it('next is disabled at the last index', () => {
    carousel.goTo(3);
    expect(nextBtn.classList.contains('ec-disabled')).toBe(true);
    expect(nextBtn.getAttribute('aria-disabled')).toBe('true');
  });

  it('prev is enabled after navigating forward', () => {
    carousel.navigate(1);
    expect(prevBtn.classList.contains('ec-disabled')).toBe(false);
    expect(prevBtn.getAttribute('aria-disabled')).toBe('false');
  });

  it('both buttons disabled when only one item exists', () => {
    // Hide all but first
    [...dom.window.document.querySelectorAll('.ec-item')].slice(1).forEach(el => {
      el.style.display = 'none';
    });
    carousel.rebuild();
    expect(prevBtn.classList.contains('ec-disabled')).toBe(true);
    expect(nextBtn.classList.contains('ec-disabled')).toBe(true);
  });
});

// ─── click suppression ───────────────────────────────────────────────────────

describe('EtherealCarousel — click suppression', () => {
  let dom, carousel;

  beforeEach(() => {
    dom = makeDOM(4);
    carousel = makeCarousel(dom);
  });

  it('suppresses clicks immediately after _noteInteraction', () => {
    carousel._noteInteraction(2000);
    expect(carousel._shouldSuppressClick()).toBe(true);
  });

  it('does not suppress before any interaction', () => {
    expect(carousel._shouldSuppressClick()).toBe(false);
  });

  it('_consumeBlockedCardClick returns true and clears the flag', () => {
    carousel._blockNextCardClick = true;
    expect(carousel._consumeBlockedCardClick()).toBe(true);
    expect(carousel._blockNextCardClick).toBe(false);
  });

  it('_consumeBlockedCardClick returns false when flag is not set', () => {
    expect(carousel._consumeBlockedCardClick()).toBe(false);
  });

  it('second call to _consumeBlockedCardClick returns false', () => {
    carousel._blockNextCardClick = true;
    carousel._consumeBlockedCardClick();
    expect(carousel._consumeBlockedCardClick()).toBe(false);
  });
});
