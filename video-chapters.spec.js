const { test, expect } = require('@playwright/test');

test.describe('Multi-chapter video projects', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#intro')).toBeHidden({ timeout: 10000 });
    await page.locator('#video-works').scrollIntoViewIfNeeded();
    await page.locator('.vw-filters button[data-filter="wedding"]').click();
  });

  test('renders a hidden chapter data block on the placeholder multi-event project', async ({ page }) => {
    const card = page.locator('.vw-card[data-title="Wedding Weekend"]');
    await expect(card).toBeVisible();

    const chapters = card.locator('.vw-chapter');
    await expect(chapters).toHaveCount(3);
    await expect(chapters.nth(0)).toHaveAttribute('data-label', 'Haldi');
    await expect(chapters.nth(1)).toHaveAttribute('data-label', 'Sangeet');
    await expect(chapters.nth(2)).toHaveAttribute('data-label', 'Wedding');

    // .vw-chapters is a hidden data source, not a visible grid element
    await expect(card.locator('.vw-chapters')).toBeHidden();
  });
});
