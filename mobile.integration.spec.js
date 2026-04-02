const { test, expect, devices } = require('@playwright/test');

async function swipeCarousel(page, selector, { startXRatio = 0.76, endXRatio = 0.28, steps = 5 } = {}) {
  await page.locator(selector).evaluate((el, options) => {
    if (typeof Touch !== 'function' || typeof TouchEvent !== 'function') {
      throw new Error('Touch constructors are unavailable in this browser context.');
    }

    const rect = el.getBoundingClientRect();
    const y = rect.top + rect.height * 0.5;
    const startX = rect.left + rect.width * options.startXRatio;
    const endX = rect.left + rect.width * options.endXRatio;

    const dispatchTouch = (type, x) => {
      const touch = new Touch({
        identifier: 1,
        target: el,
        clientX: x,
        clientY: y,
        pageX: x + window.scrollX,
        pageY: y + window.scrollY,
        screenX: x,
        screenY: y,
        radiusX: 2,
        radiusY: 2,
        rotationAngle: 0,
        force: 0.5,
      });
      const activeTouches = type === 'touchend' ? [] : [touch];
      el.dispatchEvent(new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        touches: activeTouches,
        targetTouches: activeTouches,
        changedTouches: [touch],
      }));
    };

    dispatchTouch('touchstart', startX);
    for (let step = 1; step <= options.steps; step += 1) {
      const progress = step / options.steps;
      const nextX = startX + ((endX - startX) * progress);
      dispatchTouch('touchmove', nextX);
    }
    dispatchTouch('touchend', endX);
  }, { startXRatio, endXRatio, steps });
}

const touchDevices = [
  ['iPhone SE', devices['iPhone SE']],
  ['Pixel 7', devices['Pixel 7']],
];

for (const [label, device] of touchDevices) {
  const { defaultBrowserType, ...emulation } = device;

  test.describe(`Aakaara touch regression checks — ${label}`, () => {
    test.use({ ...emulation });

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
    });

    test('shows the hero immediately without overflowing the wordmark', async ({ page }) => {
      await expect(page.locator('#intro')).toBeHidden({ timeout: 1500 });
      await expect(page.locator('#heroContent')).toBeVisible();
      await expect(page.locator('.hero-tagline')).toHaveText('Every story deserves its own canvas.');

      const box = await page.locator('#heroTitle').boundingBox();
      const viewport = page.viewportSize();
      expect(box).not.toBeNull();
      expect(viewport).not.toBeNull();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    });

    test('uses the cinematic coverflow carousel and exposes touch-safe video controls', async ({ page }) => {
      await page.locator('#portfolio').scrollIntoViewIfNeeded();

      const carouselState = await page.evaluate(() => {
        const portfolio = document.getElementById('portfolioCarousel');
        const video = document.getElementById('videoCarousel');
        const activeVideoCard = document.querySelector('#videoCarousel .vw-card[data-ec-offset="0"]');
        const sideVideoCard = document.querySelector('#videoCarousel .vw-card[data-ec-offset="1"], #videoCarousel .vw-card[data-ec-offset="-1"]');
        return {
          portfolioNative: portfolio.classList.contains('is-native-scroll'),
          videoNative: video.classList.contains('is-native-scroll'),
          activeTransform: getComputedStyle(activeVideoCard).transform,
          sideOpacity: Number(getComputedStyle(sideVideoCard).opacity),
        };
      });

      expect(carouselState.portfolioNative).toBe(false);
      expect(carouselState.videoNative).toBe(false);
      expect(carouselState.activeTransform).not.toBe('none');
      expect(carouselState.sideOpacity).toBeLessThan(1);

      await page.locator('#video-works').scrollIntoViewIfNeeded();
      await page.locator('.vw-card').first().click();
      await expect(page.locator('#videoModal')).toHaveClass(/vm-open/);

      const modalState = await page.evaluate(() => ({
        controlsOpacity: getComputedStyle(document.getElementById('vmControls')).opacity,
        muted: document.getElementById('vmVideo').muted,
        bodyOverflow: getComputedStyle(document.body).overflow,
      }));

      expect(modalState.controlsOpacity).toBe('1');
      expect(modalState.muted).toBe(true);
      expect(modalState.bodyOverflow).toBe('hidden');
    });

    test('uses native mobile date fields and 16px booking inputs', async ({ page }) => {
      await page.locator('#contact').scrollIntoViewIfNeeded();

      const formState = await page.evaluate(() => {
        const from = document.getElementById('dateFrom');
        const email = document.getElementById('contactEmail');
        return {
          dateType: from.type,
          dateMin: from.min,
          inputFontSize: getComputedStyle(email).fontSize,
        };
      });

      expect(formState.dateType).toBe('date');
      expect(formState.dateMin).not.toBe('');
      expect(formState.inputFontSize).toBe('16px');
    });

    test('defers heavy libraries and preserves scroll position after closing a film', async ({ page }) => {
      const initialState = await page.evaluate(() => ({
        hasHlsScript: [...document.scripts].some(script => script.src.includes('hls.js')),
        hasFlatpickrScript: [...document.scripts].some(script => script.src.includes('flatpickr')),
      }));

      expect(initialState.hasHlsScript).toBe(false);
      expect(initialState.hasFlatpickrScript).toBe(false);

      await page.locator('#video-works').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      await page.locator('.vw-card').first().click();
      await expect(page.locator('#videoModal')).toHaveClass(/vm-open/);
      await page.locator('#vmClose').click();
      await expect(page.locator('#videoModal')).not.toHaveClass(/vm-open/);

      const sectionState = await page.evaluate(() => {
        const section = document.getElementById('video-works');
        const rect = section.getBoundingClientRect();
        return {
          delta: Math.abs(window.scrollY - rect.top),
          top: rect.top,
          bottom: rect.bottom,
          viewportHeight: window.innerHeight,
        };
      });

      expect(sectionState.top).toBeLessThan(sectionState.viewportHeight);
      expect(sectionState.bottom).toBeGreaterThan(0);
    });

    test('does not open a film when the wedding carousel was just swiped', async ({ page }) => {
      await page.locator('#video-works').scrollIntoViewIfNeeded();
      await page.locator('#video-works .vw-filters').getByRole('button', { name: 'Weddings' }).click();
      await page.waitForTimeout(250);
      await expect(page.locator('#videoCarousel')).not.toHaveClass(/is-native-scroll/);

      const beforeTitle = await page.locator('#videoCarousel .vw-card[data-ec-offset="0"] h4').textContent();
      await swipeCarousel(page, '#videoCarousel');
      await page.waitForTimeout(220);
      const afterTitle = await page.locator('#videoCarousel .vw-card[data-ec-offset="0"] h4').textContent();
      expect(afterTitle).not.toBe(beforeTitle);

      const weddingCard = page.locator('#videoCarousel .vw-card[data-vcat="wedding"][data-ec-offset="0"]').first();
      await weddingCard.click({ force: true });
      await page.waitForTimeout(150);
      await expect(page.locator('#videoModal')).not.toHaveClass(/vm-open/);

      await page.waitForTimeout(1100);
      await weddingCard.click({ force: true });
      await expect(page.locator('#videoModal')).toHaveClass(/vm-open/);
    });
  });
}

const tabletDevices = [
  ['iPad Mini landscape', devices['iPad Mini landscape']],
  ['iPad Pro 11 landscape', devices['iPad Pro 11 landscape']],
];

for (const [label, device] of tabletDevices) {
  const { defaultBrowserType, ...emulation } = device;

  test.describe(`Aakaara tablet video regression checks — ${label}`, () => {
    test.use({ ...emulation });

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
    });

    test('keeps the wedding carousel in coverflow mode and does not open a film right after a swipe', async ({ page }) => {
      await page.locator('#video-works').scrollIntoViewIfNeeded();
      await page.locator('#video-works .vw-filters').getByRole('button', { name: 'Weddings' }).click();
      await page.waitForTimeout(250);
      await expect(page.locator('#videoCarousel')).not.toHaveClass(/is-native-scroll/);

      const carouselState = await page.locator('#videoCarousel').evaluate((el) => {
        const activeCard = el.querySelector('.vw-card[data-ec-offset="0"]');
        const sideCard = el.querySelector('.vw-card[data-ec-offset="1"], .vw-card[data-ec-offset="-1"]');
        return {
          hasNativeClass: el.classList.contains('is-native-scroll'),
          activeTransform: getComputedStyle(activeCard).transform,
          sideOpacity: Number(getComputedStyle(sideCard).opacity),
        };
      });

      expect(carouselState.hasNativeClass).toBe(false);
      expect(carouselState.activeTransform).not.toBe('none');
      expect(carouselState.sideOpacity).toBeLessThan(1);

      const beforeTitle = await page.locator('#videoCarousel .vw-card[data-ec-offset="0"] h4').textContent();
      await swipeCarousel(page, '#videoCarousel', { startXRatio: 0.78, endXRatio: 0.34, steps: 6 });
      await page.waitForTimeout(220);
      const afterTitle = await page.locator('#videoCarousel .vw-card[data-ec-offset="0"] h4').textContent();
      expect(afterTitle).not.toBe(beforeTitle);

      const weddingCard = page.locator('#videoCarousel .vw-card[data-vcat="wedding"][data-ec-offset="0"]').first();
      await weddingCard.click({ force: true });
      await page.waitForTimeout(150);
      await expect(page.locator('#videoModal')).not.toHaveClass(/vm-open/);

      await page.waitForTimeout(1100);
      await weddingCard.click({ force: true });
      await expect(page.locator('#videoModal')).toHaveClass(/vm-open/);
    });
  });
}
