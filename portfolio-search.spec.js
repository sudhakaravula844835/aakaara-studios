const { test, expect } = require('@playwright/test');

test.describe('Portfolio search and filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#intro')).toBeHidden({ timeout: 10000 });
    await page.locator('#portfolio').scrollIntoViewIfNeeded();
  });

  test('shows no-results message when search term matches nothing', async ({ page }) => {
    await page.fill('#portfolioSearch', 'zzzzz_no_match_xyz');
    await expect(page.locator('#galleryNoResults')).toBeVisible();
  });

  test('hides all gallery items when search term matches nothing', async ({ page }) => {
    await page.fill('#portfolioSearch', 'zzzzz_no_match_xyz');

    const anyVisible = await page.evaluate(() =>
      [...document.querySelectorAll('.gallery-item')].some(el => el.style.display !== 'none')
    );
    expect(anyVisible).toBe(false);
  });

  test('hides no-results message after clearing the search', async ({ page }) => {
    await page.fill('#portfolioSearch', 'zzzzz_no_match_xyz');
    await expect(page.locator('#galleryNoResults')).toBeVisible();

    await page.fill('#portfolioSearch', '');
    await expect(page.locator('#galleryNoResults')).not.toBeVisible();
  });

  test('matched items remain visible when search term hits by title', async ({ page }) => {
    // Grab the title of whichever item is currently centre-stage
    const targetTitle = await page.evaluate(() => {
      const item = [...document.querySelectorAll('.gallery-item')]
        .find(el => el.style.display !== 'none' && el.dataset.title);
      return item?.dataset.title ?? '';
    });

    if (!targetTitle) return; // safety: skip if DOM has no visible titled items

    // Use the first 4 characters as the search term (case-insensitive match guaranteed)
    await page.fill('#portfolioSearch', targetTitle.slice(0, 4).toLowerCase());

    const stillVisible = await page.evaluate((title) =>
      [...document.querySelectorAll('.gallery-item')]
        .find(el => el.dataset.title === title)?.style.display !== 'none',
      targetTitle
    );
    expect(stillVisible).toBe(true);
    await expect(page.locator('#galleryNoResults')).not.toBeVisible();
  });

  test('clicking a filter button clears the search input', async ({ page }) => {
    await page.fill('#portfolioSearch', 'wedding');

    // Click the "All" filter button (first button in the filter strip, active by default)
    const allBtn = page.locator('.portfolio-filters button').first();
    await allBtn.click();

    await expect(page.locator('#portfolioSearch')).toHaveValue('');
  });

  test('category filter shows only items of that category', async ({ page }) => {
    const weddingBtn = page.locator('#portfolio button[data-filter="wedding"]');
    await weddingBtn.click();

    // All visible items belong to the wedding category
    const wrongCatVisible = await page.evaluate(() =>
      [...document.querySelectorAll('.gallery-item')]
        .some(el => el.dataset.cat !== 'wedding' && el.style.display !== 'none')
    );
    expect(wrongCatVisible).toBe(false);

    // At least one wedding item is visible
    const weddingVisible = await page.evaluate(() =>
      [...document.querySelectorAll('.gallery-item[data-cat="wedding"]')]
        .some(el => el.style.display !== 'none')
    );
    expect(weddingVisible).toBe(true);
  });
});
