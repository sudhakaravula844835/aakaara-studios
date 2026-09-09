const { test, expect, devices } = require('@playwright/test');

const carousel = '#portfolioCarousel';
const centerCover = `${carousel} .gallery-item[data-ec-offset="0"]`;
const visibleCovers = `${carousel} .gallery-item[data-ec-offset="0"], ${carousel} .gallery-item[data-ec-offset="1"], ${carousel} .gallery-item[data-ec-offset="-1"]`;

async function grayscale(background) {
  return background.evaluate(element => {
    const value = getComputedStyle(element).filter.match(/grayscale\(([^)]+)\)/)?.[1];
    if (value === undefined) return 0;
    return parseFloat(value) / (value.endsWith('%') ? 100 : 1);
  });
}

async function expectMonochromeCovers(page) {
  const backgrounds = page.locator(visibleCovers).locator('.gi-bg');
  expect(await backgrounds.count()).toBeGreaterThanOrEqual(2);
  for (const background of await backgrounds.all()) {
    await expect.poll(() => grayscale(background)).toBe(1);
  }
}

async function decodeCover(cover) {
  await expect.poll(() => cover.locator('.gi-bg').evaluate(element => getComputedStyle(element).backgroundImage)).not.toBe('none');
  await cover.locator('.gi-bg').evaluate(async element => {
    const url = getComputedStyle(element).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
    if (!url) throw new Error('Cover has no photograph');
    const image = new Image();
    image.src = url;
    await image.decode();
  });
}

test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.addInitScript(() => sessionStorage.setItem('skipIntro', '1'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#intro')).toBeHidden({ timeout: 6000 });
  await page.locator(centerCover).scrollIntoViewIfNeeded();
});

for (const name of ['iPhone SE', 'Pixel 7']) {
  const { defaultBrowserType, ...device } = devices[name];
  test.describe(`Framed Stories cover colour — ${name}`, () => {
    test.use(device);

    test('centre and neighbouring album covers stay monochrome while browsing', async ({ page }) => {
      await expectMonochromeCovers(page);
      await page.locator(`${carousel} .ec-next`).tap();
      await expect(page.locator(`${carousel} .ec-counter-current`)).toHaveText('2');
      await expectMonochromeCovers(page);
      await expect(page.locator('#swGallery')).toBeHidden();
    });

    test('the first tap keeps colour and story text visible after the finger lifts', async ({ page }, testInfo) => {
      const cover = page.locator(centerCover);
      const background = cover.locator('.gi-bg');
      await decodeCover(cover);
      await expectMonochromeCovers(page);
      await expect(cover.locator('.gi-overlay')).toHaveCSS('opacity', '0');
      await page.screenshot({ path: testInfo.outputPath('cover-monochrome.png'), animations: 'disabled' });
      await cover.tap();
      await expect.poll(() => grayscale(background)).toBe(0);
      await expect(page.locator('#swGallery')).toBeHidden();
      await expect(cover.locator('.gi-overlay')).toHaveCSS('opacity', '1');
      await expect(cover.locator('.gi-subtitle')).toHaveCSS('opacity', '1');
      for (const line of await cover.locator('.story-line').all()) {
        await expect(line).toHaveCSS('opacity', '1');
      }
      await page.waitForTimeout(600);
      await expect.poll(() => grayscale(background)).toBe(0);
      await expect(page.locator('#swGallery')).toBeHidden();
      await page.screenshot({ path: testInfo.outputPath('cover-tap-colour-and-text.png'), animations: 'disabled' });
    });

    test('the second tap opens the album and closing resets the cover', async ({ page }) => {
      const cover = page.locator(centerCover);
      const background = cover.locator('.gi-bg');
      await cover.tap();
      await expect(page.locator('#swGallery')).toBeHidden();
      await cover.tap();
      await expect(page.locator('#swJournalScroll')).toBeVisible();
      await expect.poll(() => grayscale(background)).toBe(0);
      await page.locator('#swJournalClose').tap();
      await expect(page.locator('#swGallery')).toBeHidden();
      await expectMonochromeCovers(page);
      await expect(cover.locator('.gi-overlay')).toHaveCSS('opacity', '0');
      await cover.tap();
      await expect.poll(() => grayscale(background)).toBe(0);
      await expect(page.locator('#swGallery')).toBeHidden();
    });

    test('scrolling over a cover does not reveal it or open an album', async ({ page }) => {
      const cover = page.locator(centerCover);
      const box = await cover.boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const session = await page.context().newCDPSession(page);
      let touchEnded = false;
      try {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchStart', touchPoints: [{ x, y }],
        });
        await expectMonochromeCovers(page);
        for (let step = 1; step <= 6; step += 1) {
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchMove', touchPoints: [{ x, y: y - step * 15 }],
          });
          await page.waitForTimeout(20);
        }
        await expectMonochromeCovers(page);
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        touchEnded = true;
        await expectMonochromeCovers(page);
        await expect(page.locator('#swGallery')).toBeHidden();
      } finally {
        if (!touchEnded) await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        await session.detach();
      }
    });

    test('selecting another album or tapping outside resets the first-tap reveal', async ({ page }) => {
      const first = page.locator(centerCover);
      await first.tap();
      await expect.poll(() => grayscale(first.locator('.gi-bg'))).toBe(0);
      await page.locator(`${carousel} .ec-next`).tap();
      await expectMonochromeCovers(page);
      await expect(page.locator('#swGallery')).toBeHidden();
      // Let the carousel finish moving before selecting the next cover.
      await expect(page.locator(`${carousel} .ec-counter-current`)).toHaveText('2');
      await page.waitForTimeout(400);
      const next = page.locator(centerCover);
      await next.tap();
      await expect.poll(() => grayscale(next.locator('.gi-bg'))).toBe(0);
      await page.locator('#portfolio .section-title').tap();
      await expectMonochromeCovers(page);
      await expect(page.locator('#swGallery')).toBeHidden();
    });
  });
}

for (const width of [1440, 375]) {
  test.describe(`Mouse hover at ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 }, hasTouch: false, isMobile: false });

    test('the centre cover changes to colour on hover and returns to monochrome on leave', async ({ page }) => {
      const cover = page.locator(centerCover);
      const background = cover.locator('.gi-bg');
      await page.mouse.move(0, 0);
      await expect.poll(() => grayscale(background)).toBe(1);
      await cover.hover();
      await expect.poll(() => grayscale(background)).toBe(0);
      await page.mouse.move(0, 0);
      await expect.poll(() => grayscale(background)).toBe(1);
      await cover.click();
      await expect(page.locator('#swGallery')).toBeVisible();
    });
  });
}

test.describe('Touch cover accessibility', () => {
  const { defaultBrowserType, ...device } = devices['iPhone SE'];
  test.use(device);

  test('reduced-motion browsing also reveals before opening', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const cover = page.locator(centerCover);
    await cover.scrollIntoViewIfNeeded();
    await expect(page.locator(carousel)).toHaveClass(/is-native-scroll/);
    // Native scrolling temporarily suppresses clicks while the rail settles.
    await page.waitForTimeout(800);
    await cover.tap();
    await expect.poll(() => grayscale(cover.locator('.gi-bg'))).toBe(0);
    await expect(cover.locator('.gi-overlay')).toHaveCSS('opacity', '1');
    await expect(page.locator('#swGallery')).toBeHidden();
    await cover.tap();
    await expect(page.locator('#swJournalScroll')).toBeVisible();
  });

  test('keyboard activation opens without requiring a preview tap', async ({ page }) => {
    await page.locator(centerCover).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#swJournalScroll')).toBeVisible();
  });
});
