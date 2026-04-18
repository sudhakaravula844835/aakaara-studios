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
});

// ─── Contact form error handling ─────────────────────────────────────────────

test.describe('Contact form error handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#intro')).toBeHidden({ timeout: 10000 });
    await page.locator('#contact').scrollIntoViewIfNeeded();
  });

  async function fillAndSubmit(page) {
    await page.fill('#contactName', 'Jane Doe');
    await page.fill('#contactEmail', 'jane@example.com');
    await page.selectOption('#contactEventType', 'Wedding');
    await page.fill('#contactMessage', 'Test message for error handling.');
    await page.click('button.form-submit');
  }

  test('shows individual field errors when Formspree returns errors array', async ({ page }) => {
    await page.route('https://formspree.io/f/xlgwznnz', route =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          errors: [
            { message: 'Email is invalid' },
            { message: 'Message is too short' },
          ],
        }),
      })
    );

    await fillAndSubmit(page);

    const status = page.locator('#formStatus');
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/error/);
    await expect(status).toContainText('Email is invalid');
    await expect(status).toContainText('Message is too short');
  });

  test('shows generic error message when API returns non-errors failure body', async ({ page }) => {
    await page.route('https://formspree.io/f/xlgwznnz', route =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' }),
      })
    );

    await fillAndSubmit(page);

    const status = page.locator('#formStatus');
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/error/);
    await expect(status).toContainText('problem submitting your form');
  });

  test('shows network error message when connection is aborted', async ({ page }) => {
    await page.route('https://formspree.io/f/xlgwznnz', route => route.abort('failed'));

    await fillAndSubmit(page);

    const status = page.locator('#formStatus');
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/error/);
    await expect(status).toContainText('network error');
  });

  test('re-enables submit button after any error', async ({ page }) => {
    await page.route('https://formspree.io/f/xlgwznnz', route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    );

    await fillAndSubmit(page);

    await expect(page.locator('button.form-submit')).toBeEnabled();
    await expect(page.locator('button.form-submit')).toHaveText('Send Message');
  });
});

// ─── Gallery viewer keyboard navigation ──────────────────────────────────────

test.describe('Gallery viewer keyboard navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#intro')).toBeHidden({ timeout: 10000 });

    // Open the first real gallery item that has more than one image
    await page.evaluate(() => {
      const item = [...document.querySelectorAll('.gallery-item')]
        .find(el => el.dataset.comingSoon !== 'true' && parseInt(el.dataset.count || '1') > 1);
      item?.click();
    });
    await expect(page.locator('#swGallery')).toBeVisible();
  });

  test('ArrowRight advances to the next image and updates the counter', async ({ page }) => {
    await expect(page.locator('#swGalleryCounter')).toContainText('1 /');

    await page.keyboard.press('ArrowRight');

    await expect(page.locator('#swGalleryCounter')).toContainText('2 /');
  });

  test('ArrowLeft from the first image wraps to the last image', async ({ page }) => {
    await page.keyboard.press('ArrowLeft');

    // Counter should read "N / N" (wrapped to last frame)
    const counter = await page.locator('#swGalleryCounter').textContent();
    const [current, total] = counter.split(' / ').map(Number);
    expect(current).toBe(total);
    expect(total).toBeGreaterThan(1);
  });

  test('Escape closes the gallery viewer', async ({ page }) => {
    await expect(page.locator('#swGallery')).toHaveClass(/sw-open/);

    await page.keyboard.press('Escape');

    await expect(page.locator('#swGallery')).not.toHaveClass(/sw-open/);
  });

  test('ArrowRight then ArrowLeft returns to the first image', async ({ page }) => {
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#swGalleryCounter')).toContainText('2 /');

    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#swGalleryCounter')).toContainText('1 /');
  });
});
