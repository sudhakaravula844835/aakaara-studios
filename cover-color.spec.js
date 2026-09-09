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

    test('holding a cover reveals colour and cancelling restores monochrome', async ({ page }, testInfo) => {
      const cover = page.locator(centerCover);
      const background = cover.locator('.gi-bg');
      await decodeCover(cover);
      await expectMonochromeCovers(page);
      await page.screenshot({ path: testInfo.outputPath('cover-monochrome.png'), animations: 'disabled' });
      const box = await cover.boundingBox();
      const session = await page.context().newCDPSession(page);
      try {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
        });
        await expect.poll(() => grayscale(background)).toBe(0);
        await expect(page.locator('#swGallery')).toBeHidden();
        await page.screenshot({ path: testInfo.outputPath('cover-touch-colour.png'), animations: 'disabled' });
      } finally {
        await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        await session.detach();
      }
      await expectMonochromeCovers(page);
      await expect(page.locator('#swGallery')).toBeHidden();
    });

    test('a tap opens the album and closing restores monochrome covers', async ({ page }) => {
      const cover = page.locator(centerCover);
      const background = cover.locator('.gi-bg');
      await cover.tap();
      await expect(page.locator('#swJournalScroll')).toBeVisible();
      await expect.poll(() => grayscale(background)).toBe(0);
      await page.locator('#swJournalClose').tap();
      await expect(page.locator('#swGallery')).toBeHidden();
      await expectMonochromeCovers(page);
    });

    test('dragging vertically clears the colour preview without opening an album', async ({ page }) => {
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
        await expect.poll(() => grayscale(cover.locator('.gi-bg'))).toBe(0);
        for (let step = 1; step <= 6; step += 1) {
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchMove', touchPoints: [{ x, y: y - step * 15 }],
          });
          await page.waitForTimeout(20);
        }
        await expectMonochromeCovers(page);
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        touchEnded = true;
        await expect(page.locator('#swGallery')).toBeHidden();
      } finally {
        if (!touchEnded) await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        await session.detach();
      }
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
    });
  });
}
