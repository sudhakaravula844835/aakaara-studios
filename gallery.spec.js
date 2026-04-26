const { test, expect } = require('@playwright/test');

test.describe('Aakaara Studios Portfolio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display cinematic intro and eventually show the hero section', async ({ page }) => {
    const intro = page.locator('#intro');
    await expect(intro).toBeVisible();
    
    // Wait for intro to fade out (assuming 3-5s based on typical cinematic intros)
    await expect(intro).toBeHidden({ timeout: 10000 });
    await expect(page.locator('#home')).toBeVisible();
  });

  test('should filter portfolio items correctly', async ({ page }) => {
    // Scroll to portfolio
    await page.locator('#portfolio').scrollIntoViewIfNeeded();
    
    const weddingFilter = page.locator('#portfolio button[data-filter="wedding"]');
    await weddingFilter.click();
    
    // Verify that wedding items are visible
    const weddingItems = page.locator('.gallery-item[data-cat="wedding"]');
    await expect(weddingItems.first()).toBeVisible();
    
    // Verify that non-wedding items are hidden (assuming display: none is used)
    const maternityItems = page.locator('.gallery-item[data-cat="maternity"]');
    await expect(maternityItems.first()).not.toBeVisible();
  });

  test('should open the cinematic gallery viewer on click', async ({ page }) => {
    const firstItem = page.locator('.gallery-item').first();
    await firstItem.click();
    
    const viewer = page.locator('#swGallery');
    await expect(viewer).toBeVisible();
    await expect(page.locator('#swGalleryTitle')).not.toBeEmpty();
  });

  test('should smooth scroll to the portfolio section when clicking nav link', async ({ page }) => {
    // Wait for cinematic intro to fade out so navigation is clickable
    await expect(page.locator('#intro')).toBeHidden({ timeout: 10000 });

    const navLink = page.locator('#navLinks >> text=Portfolio');
    const targetSection = page.locator('#portfolio');

    // Click the nav link
    await navLink.click();

    // Verify the portfolio section is eventually in the viewport
    await expect(targetSection).toBeInViewport();

    // Verify scroll position eventually moves significantly from the top.
    // Smooth scrolling is an animation; we must poll until it reaches the destination.
    await expect.poll(async () => {
      return await page.evaluate(() => window.scrollY);
    }).toBeGreaterThan(500);
  });

  test('should submit the contact form successfully and redirect', async ({ page }) => {
    await expect(page.locator('#intro')).toBeHidden({ timeout: 10000 });
    await page.locator('#contact').scrollIntoViewIfNeeded();

    // Mock the Formspree response to prevent real email sending
    await page.route('https://formspree.io/f/xlgwznnz', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    await page.fill('#contactName', 'John Doe');
    await page.fill('#contactEmail', 'john@example.com');
    await page.selectOption('#contactEventType', 'Wedding');
    await page.fill('#contactMessage', 'I would love to book a cinematic session in NYC!');

    await page.click('button.form-submit');

    // Verify redirection to thank-you page
    await expect(page).toHaveURL(/thank-you.html/);
  });

  test('should trigger honeypot bot protection without sending request', async ({ page }) => {
    await expect(page.locator('#intro')).toBeHidden({ timeout: 10000 });
    await page.locator('#contact').scrollIntoViewIfNeeded();

    // Intercept potential requests to verify none are made
    let requestSent = false;
    await page.route('https://formspree.io/f/xlgwznnz', () => { requestSent = true; });

    await page.fill('#contactName', 'Bot User');
    await page.fill('#contactEmail', 'bot@example.com');
    await page.selectOption('#contactEventType', 'Wedding');
    // Use evaluate to bypass visibility checks for the hidden honeypot field
    await page.locator('input[name="_gotcha"]').evaluate(node => node.value = 'I am a robot');
    await page.fill('#contactMessage', 'This should not be sent');

    await page.click('button.form-submit');

    // Verify UI shows success but no network request was triggered
    await expect(page.locator('#formStatus')).toHaveClass(/success/);
    expect(requestSent).toBe(false);
  });

  // ── VideoFocusRail smoke tests ────────────────────────────────────────────

  test.describe('VideoFocusRail', () => {
    test.beforeEach(async ({ page }) => {
      // Skip intro and scroll FocusRail into view
      await page.evaluate(() => sessionStorage.setItem('skipIntro', '1'));
      await page.goto('/');
      await page.locator('#videoFocusRail').scrollIntoViewIfNeeded();
    });

    test('renders 6 cards with exactly one center card', async ({ page }) => {
      const cards = page.locator('#videoFocusRail .vfr-card');
      await expect(cards).toHaveCount(6);
      const centerCards = page.locator('#videoFocusRail .vfr-card.is-center');
      await expect(centerCards).toHaveCount(1);
    });

    test('counter starts at "1 / 6"', async ({ page }) => {
      const counter = page.locator('#videoFocusRail .vfr-count');
      await expect(counter).toHaveText('1 / 6');
    });

    test('clicking next advances counter to "2 / 6"', async ({ page }) => {
      await page.locator('#videoFocusRail .vfr-next').click();
      const counter = page.locator('#videoFocusRail .vfr-count');
      await expect(counter).toHaveText('2 / 6');
    });

    test('clicking prev from film 1 wraps to "6 / 6"', async ({ page }) => {
      await page.locator('#videoFocusRail .vfr-prev').click();
      const counter = page.locator('#videoFocusRail .vfr-count');
      await expect(counter).toHaveText('6 / 6');
    });

    test('Watch Film button opens the video modal', async ({ page }) => {
      await page.locator('#videoFocusRail .vfr-watch-btn').click();
      const modal = page.locator('#videoModal');
      await expect(modal).toHaveClass(/vm-open/);
    });
  });
});
