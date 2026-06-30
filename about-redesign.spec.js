const { test, expect } = require('@playwright/test');

test.describe('About the Founder — redesign', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#intro')).toBeHidden({ timeout: 10000 });
  });

  test('photo + name form a sticky unit', async ({ page }) => {
    const sticky = page.locator('.about-sticky');
    await expect(sticky).toBeVisible();
    const position = await sticky.evaluate(el => getComputedStyle(el).position);
    expect(position).toBe('sticky');
    await expect(sticky.locator('.about-image')).toBeVisible();
    await expect(sticky.locator('.about-name-wrapper')).toBeVisible();
  });

  test('bio content is split into 5 independently-revealing panels', async ({ page }) => {
    const panels = page.locator('#about .about-panel');
    await expect(panels).toHaveCount(5);
  });

  test('each panel gets the visible class as it scrolls into view', async ({ page }) => {
    const panels = page.locator('#about .about-panel');
    for (let i = 0; i < 5; i++) {
      const panel = panels.nth(i);
      await panel.scrollIntoViewIfNeeded();
      await expect(panel).toHaveClass(/visible/, { timeout: 5000 });
    }
  });

  test('photo has a continuous Ken Burns zoom animation', async ({ page }) => {
    const inner = page.locator('.about-image-inner');
    await inner.scrollIntoViewIfNeeded();
    const animationName = await inner.evaluate(el => getComputedStyle(el).animationName);
    expect(animationName).toBe('aboutKenBurns');
  });

  test('reduced motion disables both the Ken Burns zoom and panel slide-in', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await expect(page.locator('#intro')).toBeHidden({ timeout: 10000 });

    const inner = page.locator('.about-image-inner');
    const animationName = await inner.evaluate(el => getComputedStyle(el).animationName);
    expect(animationName).toBe('none');

    const panel = page.locator('#about .about-panel').first();
    const transition = await panel.evaluate(el => getComputedStyle(el).transitionProperty);
    expect(transition).toBe('none');
  });

  test('quote panel gets the rose accent border, symbolism panel gets saffron', async ({ page }) => {
    const quotePanel = page.locator('.about-panel--quote');
    const quoteBorderColor = await quotePanel.evaluate(el => getComputedStyle(el).borderLeftColor);
    expect(quoteBorderColor).toBe('rgb(201, 149, 107)'); // --rose: #c9956b

    const symbolismPanel = page.locator('.about-panel--symbolism');
    const symbolismBorderColor = await symbolismPanel.evaluate(el => getComputedStyle(el).borderLeftColor);
    expect(symbolismBorderColor).toBe('rgb(224, 164, 88)'); // --saffron: #e0a458
  });

  test('copy reads in first person and mentions travel availability', async ({ page }) => {
    await expect(page.locator('.about-lead')).toContainText('the moments nobody choreographs are the ones worth keeping');
    await expect(page.locator('#about')).toContainText('I travel wherever your story takes place');
    await expect(page.locator('#about .section-tag')).toHaveText('A Note From the Founder');
  });

  test('font override selector still targets bio paragraphs but not the symbol description', async ({ page }) => {
    const leadFont = await page.locator('.about-lead').evaluate(el => getComputedStyle(el).fontFamily);
    expect(leadFont).toContain('p22-mackinac-pro');

    const symbolDescFont = await page.locator('.symbol-desc').evaluate(el => getComputedStyle(el).fontFamily);
    expect(symbolDescFont).not.toContain('p22-mackinac-pro');
  });
});
