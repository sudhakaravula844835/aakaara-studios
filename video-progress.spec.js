const { test, expect } = require('@playwright/test');

test.describe('Film progress accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // No CDN playback is needed to exercise browser media lifecycle events.
    await page.route('https://**', route => route.abort());
    await page.goto('/');
    await expect(page.locator('#intro')).toBeHidden({ timeout: 10000 });
  });

  test('starts with a named, keyboard-focusable slider at zero', async ({ page }) => {
    const slider = page.getByRole('slider', { name: 'Video progress', includeHidden: true });
    await expect(slider).toHaveAttribute('aria-valuenow', '0');
    await expect(slider).toHaveAttribute('tabindex', '0');
    await expect(page.locator('#vmTimeDisplay')).toHaveText('0:00');
  });

  test('handles missing, infinite and changing duration without invalid UI values', async ({ page }) => {
    const slider = page.locator('#vmProgressTrack');
    await page.locator('#videoModal').evaluate(el => el.classList.add('vm-open'));
    for (const [duration, currentTime, expected, time] of [
      [NaN, 0, '0', '0:00'], [0, 10, '0', '0:00'],
      [Infinity, 10, '0', '0:00'], [100, 25, '25', '0:25'],
      [50, 25, '50', '0:25'], [100, 120, '100', '1:40'],
      [100, -10, '0', '0:00'],
    ]) {
      await page.locator('#vmVideo').evaluate((video, state) => {
        Object.defineProperty(video, 'duration', { configurable: true, value: state.duration });
        Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: state.currentTime });
        video.dispatchEvent(new Event('durationchange'));
      }, { duration, currentTime });
      await expect(slider).toHaveAttribute('aria-valuenow', expected);
      await expect(page.locator('#vmTimeDisplay')).toHaveText(time);
      expect(await page.locator('#vmProgressFill').evaluate(el => el.style.width)).toBe(expected + '%');
    }
  });

  test('focused slider retains keyboard seeking', async ({ page }) => {
    await page.locator('#videoModal').evaluate(el => el.classList.add('vm-open'));
    await page.locator('#vmStage').evaluate(el => el.classList.add('vm-has-video'));
    await page.locator('#vmVideo').evaluate(video => {
      Object.defineProperty(video, 'currentSrc', { configurable: true, value: 'test-video.mp4' });
      Object.defineProperty(video, 'duration', { configurable: true, value: 100 });
      Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 25 });
    });
    const slider = page.locator('#vmProgressTrack');
    await slider.focus();
    await expect(slider).toBeFocused();
    await slider.press('ArrowRight');
    expect(await page.locator('#vmVideo').evaluate(video => video.currentTime)).toBe(30);
    await slider.press('Home');
    expect(await page.locator('#vmVideo').evaluate(video => video.currentTime)).toBe(0);
    await slider.press('End');
    // End intentionally stops just before the media's final frame.
    expect(await page.locator('#vmVideo').evaluate(video => video.currentTime)).toBeCloseTo(99.9);
  });

  test('source reset and close clear progress even if a late timeupdate arrives', async ({ page }) => {
    await page.locator('#videoModal').evaluate(el => el.classList.add('vm-open'));
    await page.locator('#vmVideo').evaluate(video => {
      Object.defineProperty(video, 'duration', { configurable: true, value: 100 });
      Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 65 });
      video.dispatchEvent(new Event('timeupdate'));
    });
    await expect(page.locator('#vmProgressTrack')).toHaveAttribute('aria-valuenow', '65');
    await page.locator('#vmVideo').dispatchEvent('loadstart');
    await expect(page.locator('#vmProgressTrack')).toHaveAttribute('aria-valuenow', '0');
    await page.locator('#vmVideo').dispatchEvent('timeupdate');
    await page.keyboard.press('Escape');
    await page.locator('#vmVideo').dispatchEvent('timeupdate');
    await expect(page.locator('#vmProgressTrack')).toHaveAttribute('aria-valuenow', '0');
    await expect(page.locator('#vmTimeDisplay')).toHaveText('0:00');
  });
});
