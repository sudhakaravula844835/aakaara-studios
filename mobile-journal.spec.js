const { test, expect, devices } = require('@playwright/test');

const firstAlbum = '.gallery-item[data-folder="/images/weddings/abhinav-megha"]';
const liveAlbums = '#portfolio .gallery-item:not([data-coming-soon="true"])';

async function openAlbum(page, selector = firstAlbum) {
  // Exercise the shared entry point for filtered/off-centre cards as well.
  // Real centre-card taps are covered separately below.
  await page.locator(selector).evaluate(card => window.openSwGallery(card));
  await expect(page.locator('#swGallery')).toBeVisible();
}

async function closeJournal(page) {
  await page.locator('#swJournalClose').click();
  await expect(page.locator('#swGallery')).toBeHidden();
}

async function expectRowsFilled(rows) {
  const edges = await rows.evaluateAll(elements => elements.map((row, index) => {
    const box = row.getBoundingClientRect();
    const photos = [...row.querySelectorAll('.sw-journal-photo')];
    return {
      row: index + 1,
      left: photos[0].getBoundingClientRect().left - box.left,
      right: box.right - photos[photos.length - 1].getBoundingClientRect().right,
    };
  }));
  expect(edges.length).toBeGreaterThan(0);
  for (const edge of edges) {
    expect(Math.abs(edge.left), `row ${edge.row} left edge`).toBeLessThanOrEqual(1);
    expect(Math.abs(edge.right), `row ${edge.row} right edge`).toBeLessThanOrEqual(1);
  }
}

async function panUp(page) {
  const viewport = page.viewportSize();
  const session = await page.context().newCDPSession(page);
  const x = Math.round(viewport.width / 2);
  const fromY = Math.round(viewport.height * 0.8);
  const toY = Math.round(viewport.height * 0.3);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x, y: fromY }],
  });
  for (let step = 1; step <= 8; step += 1) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: fromY + (toY - fromY) * step / 8 }],
    });
    await page.waitForTimeout(20);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

test.beforeEach(async ({ page }) => {
  // Keep the checks independent of analytics, remote fonts, and CDN availability.
  await page.route('https://**', route => route.abort());
  await page.addInitScript(() => sessionStorage.setItem('skipIntro', '1'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#intro')).toBeHidden({ timeout: 6000 });
});

test.describe('Framed Stories mobile journal coverage', () => {
  const { defaultBrowserType, ...device } = devices['iPhone SE'];
  test.use(device);

  test('every live album uses the shared journal with all of its own photographs', async ({ page }) => {
    test.setTimeout(90000);
    // Verify data wiring and row geometry with real manifest dimensions;
    // visual tests below also load the original photographs.
    await page.route('**/images/**/*.jpg', route => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#65594c"/></svg>',
    }));
    const albums = await page.locator(liveAlbums).evaluateAll(cards => cards.map(card => ({
      folder: card.dataset.folder,
      title: card.dataset.title,
      subtitle: card.dataset.type,
      count: Number(card.dataset.count),
      category: card.dataset.cat,
    })));
    expect(albums.length).toBeGreaterThan(1);
    expect(new Set(albums.map(album => album.category)).size).toBe(8);

    for (const album of albums) {
      await test.step(`${album.category}: ${album.title}`, async () => {
        await openAlbum(page, `.gallery-item[data-folder=${JSON.stringify(album.folder)}]`);
        await expect(page.locator('#swGallery')).toHaveClass(/sw-journal-mode/);
        await expect(page.locator('#swJournalTitle')).toHaveText(album.title);
        await expect(page.locator('#swJournalSubtitle')).toHaveText(album.subtitle);
        await expect(page.locator('#swJournalGrid .sw-journal-photo')).toHaveCount(album.count);
        const photoSources = await page.locator('#swJournalGrid .sw-journal-photo img').evaluateAll(images =>
          images.map(image => decodeURIComponent(new URL(image.src).pathname))
        );
        expect(new Set(photoSources).size).toBe(album.count);
        expect(photoSources.every(source => source.startsWith(`${album.folder}/`))).toBe(true);
        await expectRowsFilled(page.locator('#swJournalGrid .sw-journal-row'));
        await closeJournal(page);
      });
    }
  });

  test('coming-soon albums retain their notice after browsing a live story', async ({ page }) => {
    await openAlbum(page);
    await closeJournal(page);
    await openAlbum(page, '.gallery-item[data-folder="/images/weddings/pooja-amit"]');
    await expect(page.locator('#swGallery')).toHaveClass(/sw-is-coming-soon/);
    await expect(page.locator('#swComingSoonTitle')).toHaveText('Pooja & Amit');
    await expect(page.locator('#swJournalScroll')).toBeHidden();
    await page.locator('#swGalleryClose').click();
    await expect(page.locator('#swGallery')).toBeHidden();
  });

  test('an unavailable photograph preserves its place and has a useful enlarged fallback', async ({ page }) => {
    await page.route('**/images/weddings/abhinav-megha/5.jpg', route => route.fulfill({
      status: 404, contentType: 'text/plain', body: 'Not found',
    }));
    await openAlbum(page);
    const failedPhoto = page.locator('#swJournalGrid .sw-journal-photo[data-index="4"]');
    await failedPhoto.scrollIntoViewIfNeeded();
    await expect(failedPhoto.locator('.sw-journal-error')).toHaveText('Photograph unavailable');
    await expect(page.locator('#swJournalGrid .sw-journal-photo')).toHaveCount(54);
    await failedPhoto.click();
    await expect(page.locator('#swJournalDetail')).toBeVisible();
    await expect(page.locator('#swJournalDetail')).toContainText('Photograph unavailable');
    await page.locator('#swJournalBack').click();
    await expect(page.locator('#swJournalDetail')).toBeHidden();
    await expect(failedPhoto).toBeInViewport();
  });

  test('an album remains browsable when the optional layout index is unavailable', async ({ page }) => {
    await page.route('**/images/gallery-manifest.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
    await openAlbum(page);
    await expect(page.locator('#swJournalGrid .sw-journal-photo')).toHaveCount(54);
    const first = page.locator('#swJournalGrid .sw-journal-photo').first();
    await expect.poll(() => first.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    expect(await first.locator('img').evaluate(image => image.naturalWidth / image.naturalHeight)).toBeLessThan(1);
    await expectRowsFilled(page.locator('#swJournalGrid .sw-journal-row').first());
    await first.click();
    await expect(page.locator('#swJournalDetailImg')).toBeVisible();
    await page.locator('#swJournalBack').click();
    await closeJournal(page);
  });

  test('keyboard focus stays in the journal and Escape returns from a photo before closing the album', async ({ page }) => {
    await openAlbum(page);
    await expect(page.locator('#swJournalGrid .sw-journal-photo')).toHaveCount(54);
    await expect(page.locator('#swJournalClose')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#swJournalGrid .sw-journal-photo').last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#swJournalClose')).toBeFocused();
    await page.keyboard.press('Tab');
    const selected = page.locator('#swJournalGrid .sw-journal-photo').first();
    await expect(selected).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#swJournalBack')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#swJournalDetail')).toBeHidden();
    await expect(selected).toBeFocused();
    await expect(page.locator('#swGallery')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#swGallery')).toBeHidden();
  });
});

for (const name of ['iPhone SE', 'Pixel 7']) {
  const { defaultBrowserType, ...device } = devices[name];
  test.describe(`Mobile photo journal — ${name}`, () => {
    test.use(device);

    test('standalone portraits fill the row without cropping the photograph', async ({ page }, testInfo) => {
      await openAlbum(page);
      const rows = page.locator('#swJournalGrid .sw-journal-row');
      await expect(page.locator('#swJournalGrid .sw-journal-photo')).toHaveCount(54);
      const index = await rows.evaluateAll(elements => elements.findIndex((row, rowIndex) => {
        const photos = row.querySelectorAll('.sw-journal-photo');
        const image = row.querySelector('img');
        return rowIndex > 0 && photos.length === 1 && image.width < image.height;
      }));
      expect(index).toBeGreaterThan(0);
      const row = rows.nth(index);
      await row.scrollIntoViewIfNeeded();
      await expect.poll(() => row.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      await row.locator('img').evaluate(async image => {
        await image.decode();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await expect(row.locator('img')).toBeVisible();
      await expect(row.locator('img')).toHaveCSS('opacity', '1');
      await expect(row.locator('img')).toHaveCSS('visibility', 'visible');
      await page.screenshot({ path: testInfo.outputPath('journal-single-portrait.png'), animations: 'disabled' });
      await expectRowsFilled(row);
      const imageGeometry = await row.locator('img').evaluate(image => {
        const box = image.getBoundingClientRect();
        return { displayed: box.width / box.height, original: image.naturalWidth / image.naturalHeight };
      });
      expect(imageGeometry.original).toBeLessThan(1);
      expect(Math.abs(imageGeometry.displayed - imageGeometry.original)).toBeLessThan(0.015);
    });

    test('opens from the cover with full-width photographs, paired portraits, and no crop', async ({ page }, testInfo) => {
      await page.locator('#portfolio').scrollIntoViewIfNeeded();
      await page.locator(firstAlbum).click();
      await expect(page.locator('#swJournalScroll')).toBeVisible();
      await expect(page.locator('#swGalleryStage')).toBeHidden();
      await expect(page.locator('#swGalleryStrip')).toBeHidden();
      const rows = page.locator('#swJournalGrid .sw-journal-row');
      const pair = rows.filter({ has: page.locator('.sw-journal-photo:nth-child(2)') }).first();
      await expect(pair).toBeVisible();
      await expect.poll(() => rows.first().locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      await pair.scrollIntoViewIfNeeded();
      await expect.poll(() => pair.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);

      const state = await page.locator('#swJournalGrid').evaluate(grid => {
        const gridBox = grid.getBoundingClientRect();
        const items = [...grid.querySelectorAll('.sw-journal-photo img')].filter(image => image.complete && image.naturalWidth);
        const firstImage = grid.querySelector('.sw-journal-photo img');
        const portraitRow = [...grid.querySelectorAll('.sw-journal-row')].find(row => row.querySelectorAll('.sw-journal-photo').length === 2);
        const portraitBoxes = [...portraitRow.querySelectorAll('img')].map(image => image.getBoundingClientRect());
        return {
          gridWidth: gridBox.width,
          heroWidth: firstImage.getBoundingClientRect().width,
          heroRatio: firstImage.naturalWidth / firstImage.naturalHeight,
          pairedTopDifference: Math.abs(portraitBoxes[0].top - portraitBoxes[1].top),
          pairWidths: portraitBoxes.map(box => box.width),
          ratioErrors: items.map(image => {
            const box = image.getBoundingClientRect();
            return Math.abs(box.width / box.height - image.naturalWidth / image.naturalHeight);
          }),
          overflow: document.getElementById('swJournalScroll').scrollWidth - document.getElementById('swJournalScroll').clientWidth,
        };
      });
      expect(state.heroWidth).toBeGreaterThan(page.viewportSize().width * 0.9);
      expect(state.heroRatio).toBeGreaterThan(1);
      expect(state.pairedTopDifference).toBeLessThan(2);
      expect(state.pairWidths.every(width => width > state.gridWidth * 0.4 && width < state.gridWidth * 0.6)).toBe(true);
      expect(state.ratioErrors.every(error => error < 0.015)).toBe(true);
      expect(state.overflow).toBeLessThanOrEqual(1);
      await page.locator('#swJournalScroll').evaluate(element => { element.scrollTop = 0; });
      await page.screenshot({ path: testInfo.outputPath('journal-opening.png'), animations: 'disabled' });
      await page.locator('#swJournalScroll').evaluate(element => { element.scrollTop = 440; });
      await page.screenshot({ path: testInfo.outputPath('journal-scrolled.png'), animations: 'disabled' });
    });

    test('scrolls by touch, enlarges a photograph, and returns to the same place', async ({ page }) => {
      await openAlbum(page);
      const scroller = page.locator('#swJournalScroll');
      await expect(page.locator('#swJournalGrid .sw-journal-photo')).toHaveCount(54);
      await panUp(page);
      await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(100);

      const photo = page.locator('#swJournalGrid .sw-journal-photo[data-index="9"]');
      await photo.scrollIntoViewIfNeeded();
      const source = await photo.locator('img').getAttribute('src');
      await expect.poll(() => photo.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      await photo.click();
      const scrollBefore = await scroller.evaluate(element => element.scrollTop);
      await expect(page.locator('#swJournalDetail')).toBeVisible();
      await expect(page.locator('#swJournalDetailImg')).toHaveAttribute('src', source);
      await page.locator('#swJournalNext').click();
      await expect(page.locator('#swJournalDetailImg')).not.toHaveAttribute('src', source);
      await page.locator('#swJournalPrev').click();
      await expect(page.locator('#swJournalDetailImg')).toHaveAttribute('src', source);
      await page.locator('#swJournalBack').click();
      await expect(page.locator('#swJournalDetail')).toBeHidden();
      expect(Math.abs(await scroller.evaluate(element => element.scrollTop) - scrollBefore)).toBeLessThan(2);
      await expect(photo).toBeInViewport();
    });

    test('closing the story returns to Framed Stories without moving the page', async ({ page }) => {
      await page.locator('#portfolio').scrollIntoViewIfNeeded();
      const card = page.locator(firstAlbum);
      await card.scrollIntoViewIfNeeded();
      await card.focus();
      const originalScroll = await page.evaluate(() => window.scrollY);
      await card.click();
      await page.locator('#swJournalGrid .sw-journal-photo').nth(8).scrollIntoViewIfNeeded();
      await closeJournal(page);
      expect(Math.abs(await page.evaluate(() => window.scrollY) - originalScroll)).toBeLessThan(2);
      await expect(card).toBeFocused();
      expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
    });
  });
}

test.describe('Photo journal phone rotation', () => {
  const { defaultBrowserType, ...device } = devices['iPhone 13'];
  test.use(device);

  test('phone rotation keeps a scrolling journal without horizontal overflow', async ({ page }) => {
    await openAlbum(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('#swGallery')).toHaveClass(/sw-journal-mode/);
    await expect(page.locator('#swJournalScroll')).toBeVisible();
    const overflow = await page.locator('#swJournalScroll').evaluate(element => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('Desktop gallery preservation', () => {
  test('desktop preserves the cinematic viewer and thumbnail navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openAlbum(page);
    await expect(page.locator('#swGallery')).not.toHaveClass(/sw-journal-mode/);
    await expect(page.locator('#swGalleryStage')).toBeVisible();
    await expect(page.locator('#swGalleryStrip')).toBeVisible();
    await expect(page.locator('#swJournalScroll')).toBeHidden();
    await expect(page.locator('#swGalleryCounter')).toHaveText('1 / 54');
    await page.locator('#swGalleryNext').click();
    await expect(page.locator('#swGalleryCounter')).toHaveText('2 / 54');
    await page.locator('#swGalleryStrip .sw-strip-thumb').nth(4).click();
    await expect(page.locator('#swGalleryCounter')).toHaveText('5 / 54');
    await page.locator('#swGalleryClose').click();
    await expect(page.locator('#swGallery')).toBeHidden();
  });
});
