const { test, expect } = require('@playwright/test');

// index.html ships no multi-chapter film right now: the "Wedding Weekend" placeholder was a
// Coming Soon card and has been removed. Splice an equivalent card into the served page so
// the chapters feature stays covered; drop this fixture once a real multi-chapter film is live.
const PRE_WEDDING_ANCHOR = '<!-- PRE-WEDDING VIDEOS -->';
const WEDDING_WEEKEND_CARD = `
      <div class="vw-card vw-gi-5" data-vcat="wedding" data-video="" data-title="Wedding Weekend" data-type="Haldi Film" data-poster="">
        <div class="vw-poster vw-gi-5"></div>
        <div class="vw-play-wrap">
          <div class="vw-play-ring"></div>
          <div class="vw-play-icon">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
        <div class="vw-overlay">
          <div class="vw-badge">Wedding</div>
          <h3>Wedding Weekend</h3>
          <p>Haldi Film</p>
        </div>
        <div class="vw-duration">Full Film</div>
        <div class="vw-chapters">
          <button class="vw-chapter active" data-label="Haldi" data-video="" data-type="Haldi Film"></button>
          <button class="vw-chapter" data-label="Sangeet" data-video="" data-type="Sangeet Film"></button>
          <button class="vw-chapter" data-label="Wedding" data-video="" data-type="Wedding Film"></button>
        </div>
      </div>

      `;

test.describe('Multi-chapter video projects', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(url => url.pathname === '/', async route => {
      const response = await route.fetch();
      const html = (await response.text()).replace(PRE_WEDDING_ANCHOR, WEDDING_WEEKEND_CARD + PRE_WEDDING_ANCHOR);
      await route.fulfill({ status: response.status(), contentType: 'text/html; charset=utf-8', body: html });
    });
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

  test('shows an auto-computed "N Films" badge on multi-chapter projects', async ({ page }) => {
    const card = page.locator('.vw-card[data-title="Wedding Weekend"]');
    await expect(card.locator('.vw-badge-count')).toHaveText('3 Films');
  });

  test('does not show a films badge on single-video cards', async ({ page }) => {
    const card = page.locator('.vw-card[data-title="Pooja & Amit"]');
    await expect(card.locator('.vw-badge-count')).toHaveCount(0);
  });

  test('opens the modal on the default chapter and lists chapter tabs', async ({ page }) => {
    await page.locator('.vw-card[data-title="Wedding Weekend"]').click();
    await expect(page.locator('#videoModal')).toHaveClass(/vm-open/);

    const tabs = page.locator('#vmChapters .vm-chapter-tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveText('Haldi');
    await expect(tabs.nth(0)).toHaveClass(/active/);
    await expect(page.locator('#vmSubtitle')).toHaveText('Haldi Film');
  });

  test('switches chapters in place without closing the modal', async ({ page }) => {
    await page.locator('.vw-card[data-title="Wedding Weekend"]').click();
    await expect(page.locator('#videoModal')).toHaveClass(/vm-open/);

    const tabs = page.locator('#vmChapters .vm-chapter-tab');
    await tabs.nth(1).click(); // Sangeet
    await expect(page.locator('#videoModal')).toHaveClass(/vm-open/); // still open
    await expect(tabs.nth(1)).toHaveClass(/active/);
    await expect(tabs.nth(0)).not.toHaveClass(/active/);
    await expect(page.locator('#vmSubtitle')).toHaveText('Sangeet Film');

    await tabs.nth(2).click(); // Wedding
    await expect(page.locator('#vmSubtitle')).toHaveText('Wedding Film');
  });

  test('resets to the default chapter when reopened', async ({ page }) => {
    const card = page.locator('.vw-card[data-title="Wedding Weekend"]');
    await card.click();
    await page.locator('#vmChapters .vm-chapter-tab').nth(2).click(); // Wedding
    await expect(page.locator('#vmSubtitle')).toHaveText('Wedding Film');

    await page.locator('#vmClose').click();
    await expect(page.locator('#videoModal')).not.toHaveClass(/vm-open/);

    await card.click();
    await expect(page.locator('#vmSubtitle')).toHaveText('Haldi Film');
    await expect(page.locator('#vmChapters .vm-chapter-tab').nth(0)).toHaveClass(/active/);
  });

  test('single-video cards still open without a chapter tab row', async ({ page }) => {
    await page.locator('.vw-card[data-title="Pooja & Amit"]').click();
    await expect(page.locator('#videoModal')).toHaveClass(/vm-open/);
    await expect(page.locator('#vmChapters')).toBeHidden();
  });
});
