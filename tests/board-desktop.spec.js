// tests/board-desktop.spec.js
// Click-through pass against the real Supabase project with real role
// sessions (see tests/board-helpers.js) -- no mocked auth, no stubbed
// network responses. Covers what the code-review-only QA pass in commit
// b8af4d8 flagged as unverified: Kanban drag-and-drop, the Dashboard view,
// and Copy Client Link.
import { test, expect } from '@playwright/test';
import {
  boardEnvAvailable, adminClient,
  createTestUser, deleteTestUser,
  createTestProject, deleteTestProject,
  realSessionStorageState,
} from './board-helpers.js';

test.describe('Board desktop click-through', () => {
  test.skip(!boardEnvAvailable, 'board/.env credentials not available -- see board/.env.example');

  test.describe('Login form', () => {
    let pm;
    let deactivated;

    test.afterEach(async () => {
      if (pm) await deleteTestUser(pm.id);
      if (deactivated) await deleteTestUser(deactivated.id);
      pm = null;
      deactivated = null;
    });

    test('PM signs in through the real form and lands on the Kanban board', async ({ page }) => {
      pm = await createTestUser('pm');
      await page.goto('/board/login.html');
      await page.locator('#lEmail').fill(pm.email);
      await page.locator('#lPassword').fill(pm.password);
      await page.locator('.login-submit').click();
      await page.waitForURL('**/board/index.html');
      await expect(page.locator('.board-header h1')).toHaveText('Project Board');
    });

    test('a deactivated user sees "access revoked" directly on the login form, not a silent bounce', async ({ page }) => {
      deactivated = await createTestUser('pm', { active: false });
      await page.goto('/board/login.html');
      await page.locator('#lEmail').fill(deactivated.email);
      await page.locator('#lPassword').fill(deactivated.password);
      await page.locator('.login-submit').click();
      await expect(page.locator('#loginError')).toContainText('revoked');
      await expect(page).toHaveURL(/login\.html/);
    });

    // Regression test for the login.js line 16-18 fix: a deactivated user who
    // still has a valid session (e.g. a second tab open before being
    // deactivated) and lands on login.html directly should see the same
    // "access revoked" message immediately, instead of being auto-redirected
    // to index.html/editor.html by the old un-guarded getSession().then(...)
    // path and only being ejected a beat later by that page's own check.
    test('a deactivated user with an existing session sees "access revoked" on login.html, without bouncing through the board first', async ({ page, context }) => {
      deactivated = await createTestUser('pm');
      const state = await realSessionStorageState(deactivated.email, deactivated.password, 'http://localhost:5173');
      await context.addCookies(state.cookies);
      await context.addInitScript((entry) => {
        window.localStorage.setItem(entry.name, entry.value);
      }, state.origins[0].localStorage[0]);

      // Deactivate *after* minting the session, exactly like the real "second
      // tab already open" scenario this guards against.
      await adminClient.from('profiles').update({ active: false }).eq('id', deactivated.id);

      await page.goto('/board/login.html');
      await expect(page.locator('#loginError')).toContainText('revoked');
      await expect(page).toHaveURL(/login\.html/);
    });
  });

  test.describe('Authenticated board views', () => {
    // These tests share one project's stage across the file's default
    // fullyParallel config -- the Kanban-drag test moves it to
    // shoot_completed and later tests read that same row, so this describe
    // must run serially within one worker, not interleaved/reordered.
    test.describe.configure({ mode: 'serial' });

    let pm;
    let project;
    let sessionState;

    test.beforeAll(async () => {
      pm = await createTestUser('pm');
      project = await createTestProject({ stage: 'booked' });
      sessionState = await realSessionStorageState(pm.email, pm.password, 'http://localhost:5173');
    });

    test.afterAll(async () => {
      if (project) await deleteTestProject(project.id);
      if (pm) await deleteTestUser(pm.id);
    });

    test.use({ storageState: async ({}, use) => use(sessionState) });

    test('Dashboard is the default landing view and its search filters cards', async ({ page }) => {
      await page.goto('/board/index.html');
      await expect(page.locator('#dashboardViewContainer')).toHaveClass(/view-active/);
      const card = page.locator('.dash-card', { hasText: project.client_name });
      await expect(card).toBeVisible();

      await page.locator('#dashSearch').fill('zzz-no-such-client-zzz');
      await expect(card).toHaveCount(0);
      await expect(page.locator('.dash-empty')).toContainText('No projects match your search.');

      await page.locator('#dashSearch').fill('');
      await expect(card).toBeVisible();
    });

    test('Kanban drag-and-drop with a mouse moves a card to a new column and persists to the DB', async ({ page }) => {
      await page.goto('/board/index.html');
      await page.locator('.view-toggle-btn[data-view="kanban"]').click();
      await expect(page.locator('#boardColumns')).toHaveClass(/view-active/);

      const card = page.locator(`.project-card[data-id="${project.id}"]`);
      await expect(card).toBeVisible();
      const sourceColumn = page.locator('.board-column-cards[data-stage="booked"]');
      await expect(card).toBeVisible({ timeout: 5000 });
      await expect(sourceColumn.locator(`[data-id="${project.id}"]`)).toHaveCount(1);

      const targetColumn = page.locator('.board-column-cards[data-stage="shoot_completed"]');
      await card.dragTo(targetColumn);

      // handleDrop's own success path relies on the realtime redraw (or its
      // 3s safety-net refresh) to actually move the card in the DOM -- assert
      // on the thing that matters, the persisted DB row, with generous
      // headroom for that redraw.
      await expect.poll(async () => {
        const { data } = await adminClient.from('projects').select('stage').eq('id', project.id).single();
        return data?.stage;
      }, { timeout: 8000 }).toBe('shoot_completed');

      await expect(targetColumn.locator(`[data-id="${project.id}"]`)).toBeVisible({ timeout: 8000 });
    });

    test('Copy Client Link copies a working token URL to the clipboard', async ({ page, context, browserName }) => {
      test.skip(browserName !== 'chromium', 'clipboard-read permission is Chromium-only');
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      await page.goto('/board/index.html');
      await page.locator('.dash-card', { hasText: project.client_name }).click();
      await expect(page.locator('#detailBackdrop')).toHaveClass(/open/);

      await page.locator('#detailCopyLinkBtn').click();
      await expect(page.locator('.toast-success', { hasText: 'Client link copied' })).toBeVisible();

      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      const { data: fresh } = await adminClient.from('projects').select('client_access_token').eq('id', project.id).single();
      expect(clipboardText).toBe(`https://aakaarastudiosnyc.com/board/client.html?token=${fresh.client_access_token}`);
    });
  });
});
