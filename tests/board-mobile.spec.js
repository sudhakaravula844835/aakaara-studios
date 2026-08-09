// tests/board-mobile.spec.js
// Mobile-viewport QA across all four board/ role UIs, using Playwright
// device emulation with real touch input (hasTouch: true) and real
// Supabase sessions -- same standard as tests/board-desktop.spec.js.
import { test, expect, devices } from '@playwright/test';
import {
  boardEnvAvailable, adminClient,
  createTestUser, deleteTestUser,
  createTestProject, deleteTestProject,
  realSessionStorageState,
} from './board-helpers.js';

// defaultBrowserType is stripped from each device preset -- test.use() with
// it set inside a describe group forces a new worker, which Playwright only
// allows at the top level of a file (same workaround tests/intake.spec.js
// already uses for its iPhone 13 touch-device describe block).
function stripDefaultBrowserType(device) {
  const { defaultBrowserType, ...rest } = device;
  return rest;
}

const MOBILE_PROFILES = [
  { name: 'iPhone 13', device: stripDefaultBrowserType(devices['iPhone 13']) },
  { name: 'Pixel 7 (Android)', device: stripDefaultBrowserType(devices['Pixel 7']) },
];

// Dispatches real TouchEvent objects (not mouse events standing in for
// touch) from `from` to `to`, the way an actual phone would. Native HTML5
// drag-and-drop (draggable=true + dragstart/dragover/drop) only ever hooks
// into the browser's mouse-driven DnD machinery -- Chromium's touch
// emulation genuinely never fires dragstart from a touch gesture, same as a
// real iOS/Android device, so this is a faithful reproduction, not a
// simulation stand-in.
async function dispatchTouchDrag(page, fromSelector, toSelector) {
  await page.evaluate(([from, to]) => {
    const source = document.querySelector(from);
    const target = document.querySelector(to);
    const sr = source.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    const start = { x: sr.left + sr.width / 2, y: sr.top + sr.height / 2 };
    const end = { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 };

    function touchEvent(type, el, point) {
      const touch = new Touch({ identifier: 1, target: el, clientX: point.x, clientY: point.y });
      el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: [touch], changedTouches: [touch] }));
    }

    touchEvent('touchstart', source, start);
    touchEvent('touchmove', source, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 });
    touchEvent('touchmove', source, end);
    touchEvent('touchend', source, end);
  }, [fromSelector, toSelector]);
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(overflow.scrollWidth, `${label}: document.documentElement.scrollWidth (${overflow.scrollWidth}) should not exceed window.innerWidth (${overflow.innerWidth})`)
    .toBeLessThanOrEqual(overflow.innerWidth + 1);
}

test.describe('Board mobile QA', () => {
  test.skip(!boardEnvAvailable, 'board/.env credentials not available -- see board/.env.example');

  for (const { name, device } of MOBILE_PROFILES) {
    test.describe(name, () => {
      test.use({ ...device });

      test.describe('Login page', () => {
        let user;
        test.afterEach(async () => { if (user) await deleteTestUser(user.id); user = null; });

        test('login form fits without horizontal overflow and works via touch tap', async ({ page }) => {
          user = await createTestUser('pm');
          await page.goto('/board/login.html');
          await assertNoHorizontalOverflow(page, 'login.html');
          await page.locator('#lEmail').tap();
          await page.locator('#lEmail').fill(user.email);
          await page.locator('#lPassword').tap();
          await page.locator('#lPassword').fill(user.password);
          await page.locator('.login-submit').tap();
          await page.waitForURL('**/board/index.html');
        });

        test('a deactivated user tapping Log In sees "access revoked" directly', async ({ page }) => {
          user = await createTestUser('pm', { active: false });
          await page.goto('/board/login.html');
          await page.locator('#lEmail').fill(user.email);
          await page.locator('#lPassword').fill(user.password);
          await page.locator('.login-submit').tap();
          await expect(page.locator('#loginError')).toContainText('revoked');
        });
      });

      test.describe('Owner/PM board (index.html)', () => {
        // The touch-drag and List-view tests below share one project's
        // stage in sequence (assert it's unchanged, then legitimately change
        // it) -- must run serially, not interleaved by fullyParallel.
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

        test('lands on Dashboard by default (not stuck on an unusable Kanban), no horizontal overflow', async ({ page }) => {
          await page.goto('/board/index.html');
          await expect(page.locator('#dashboardViewContainer')).toHaveClass(/view-active/);
          await expect(page.locator('#boardColumns')).not.toHaveClass(/view-active/);
          await assertNoHorizontalOverflow(page, 'index.html (dashboard)');
        });

        test('view-switcher tabs are all tappable and reach every view, without horizontal page overflow', async ({ page }) => {
          await page.goto('/board/index.html');
          for (const view of ['kanban', 'list', 'calendar', 'dashboard']) {
            await page.locator(`.view-toggle-btn[data-view="${view}"]`).tap();
            await expect(page.locator(`.view-toggle-btn[data-view="${view}"]`)).toHaveClass(/active/);
            await assertNoHorizontalOverflow(page, `index.html (${view} view)`);
          }
        });

        test('Kanban card is draggable=true but a real touch drag never fires dragstart and never changes the stage', async ({ page }) => {
          await page.goto('/board/index.html');
          await page.locator('.view-toggle-btn[data-view="kanban"]').tap();
          const cardSelector = `.project-card[data-id="${project.id}"]`;
          await expect(page.locator(cardSelector)).toBeVisible();

          await page.evaluate((sel) => {
            window.__dragStartFired = false;
            document.querySelector(sel).addEventListener('dragstart', () => { window.__dragStartFired = true; });
          }, cardSelector);

          await dispatchTouchDrag(page, cardSelector, '.board-column-cards[data-stage="shoot_completed"]');

          // Give any (incorrectly-fired) handler a moment, then assert
          // nothing happened: no dragstart, card still in its original
          // column, DB stage unchanged. This is the empirical proof that
          // native HTML5 DnD is a dead interaction on a touch device here.
          await page.waitForTimeout(300);
          expect(await page.evaluate(() => window.__dragStartFired)).toBe(false);
          await expect(page.locator('.board-column-cards[data-stage="booked"]').locator(`[data-id="${project.id}"]`)).toHaveCount(1);
          const { data } = await adminClient.from('projects').select('stage').eq('id', project.id).single();
          expect(data.stage).toBe('booked');
        });

        test('List view stage dropdown is a working touch-friendly fallback for the same action', async ({ page }) => {
          await page.goto('/board/index.html');
          await page.locator('.view-toggle-btn[data-view="list"]').tap();
          const row = page.locator('.list-row', { hasText: project.client_name });
          await expect(row).toBeVisible();
          const select = row.locator('.list-stage-select');
          await select.selectOption('shoot_completed');

          await expect.poll(async () => {
            const { data } = await adminClient.from('projects').select('stage').eq('id', project.id).single();
            return data?.stage;
          }, { timeout: 8000 }).toBe('shoot_completed');
        });

        test('text inputs use a 16px+ font size on mobile (no iOS zoom-on-focus)', async ({ page }) => {
          await page.goto('/board/index.html');
          await page.locator('#addProjectBtn').tap();
          await expect(page.locator('#projectModalBackdrop')).toHaveClass(/open/);
          const fontSize = await page.locator('#fClientName').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
          expect(fontSize).toBeGreaterThanOrEqual(16);
        });

        test('the project modal (a large multi-section form) fits the viewport without horizontal scrolling', async ({ page }) => {
          await page.goto('/board/index.html');
          await page.locator('#addProjectBtn').tap();
          await expect(page.locator('#projectModalBackdrop')).toHaveClass(/open/);
          await assertNoHorizontalOverflow(page, 'index.html (project modal open)');
          const box = await page.locator('#projectModalBackdrop .modal-box').boundingBox();
          const viewport = page.viewportSize();
          expect(box.width).toBeLessThanOrEqual(viewport.width + 1);
        });
      });

      test.describe('Editor mobile (editor.html)', () => {
        let editor;
        let pm;
        let project;
        let sessionState;

        test.beforeAll(async () => {
          editor = await createTestUser('editor');
          pm = await createTestUser('pm');
          project = await createTestProject({ stage: 'video_editing', video_editing_substatus: 'not_started', pm_id: pm.id });
          await adminClient.from('project_editors').insert({ project_id: project.id, editor_id: editor.id });
          sessionState = await realSessionStorageState(editor.email, editor.password, 'http://localhost:5173');
        });
        test.afterAll(async () => {
          if (project) await deleteTestProject(project.id);
          if (editor) await deleteTestUser(editor.id);
          if (pm) await deleteTestUser(pm.id);
        });
        test.use({ storageState: async ({}, use) => use(sessionState) });

        test('project list, detail panel, substatus control, and comments are usable without horizontal overflow', async ({ page }) => {
          await page.goto('/board/editor.html');
          await assertNoHorizontalOverflow(page, 'editor.html (list)');

          await page.locator('.list-row', { hasText: project.client_name }).tap();
          await expect(page.locator('#detailBackdrop')).toHaveClass(/open/);
          await assertNoHorizontalOverflow(page, 'editor.html (detail panel open)');

          const substatusSelect = page.locator('#substatusSelect');
          await expect(substatusSelect).toBeEnabled();
          await substatusSelect.selectOption('in_progress');
          await expect.poll(async () => {
            const { data } = await adminClient.from('projects').select('video_editing_substatus').eq('id', project.id).single();
            return data?.video_editing_substatus;
          }, { timeout: 8000 }).toBe('in_progress');

          await page.locator('#commentBody').tap();
          await page.locator('#commentBody').fill('Mobile QA comment from editor');
          const commentFontSize = await page.locator('#commentBody').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
          expect(commentFontSize).toBeGreaterThanOrEqual(16);
          await page.locator('#commentForm button[type="submit"]').tap();
          await expect(page.locator('.feed-body', { hasText: 'Mobile QA comment from editor' })).toBeVisible();
        });
      });

      // Held to the highest bar per the task brief -- this is the one role
      // guaranteed to be opened primarily on a phone in practice.
      test.describe('Client portal (client.html) — highest bar', () => {
        let project;
        let subEvent;

        test.beforeAll(async () => {
          project = await createTestProject({ stage: 'photo_selection' });
          const { data } = await adminClient
            .from('sub_events')
            .insert({ project_id: project.id, name: 'Wedding Day', photo_total_count: 500 })
            .select()
            .single();
          subEvent = data;
        });
        test.afterAll(async () => { if (project) await deleteTestProject(project.id); });

        test('tracker, status grid, and forms render without horizontal overflow and inputs avoid iOS zoom', async ({ page }) => {
          await page.goto(`/board/client.html?token=${project.client_access_token}`);
          await expect(page.locator('.client-project-name')).toHaveText(project.client_name);
          await assertNoHorizontalOverflow(page, 'client.html');

          const photoInput = page.locator('.client-photo-list-input').first();
          const photoFontSize = await photoInput.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
          expect(photoFontSize).toBeGreaterThanOrEqual(16);
        });

        test('photo selection can be submitted via touch and is persisted', async ({ page }) => {
          await page.goto(`/board/client.html?token=${project.client_access_token}`);
          const row = page.locator('.client-sub-event-row', { hasText: 'Wedding Day' });
          const input = row.locator('.client-photo-list-input');
          await input.tap();
          await input.fill('0012, 0019, 0044');
          await row.locator('button[type="submit"]').tap();
          await expect(page.locator('.toast-success', { hasText: 'Photo list submitted' })).toBeVisible();

          await expect.poll(async () => {
            const { data } = await adminClient.from('sub_events').select('photo_selected_count').eq('id', subEvent.id).single();
            return data?.photo_selected_count;
          }, { timeout: 8000 }).toBe(3);
        });

        test('a song suggestion can be submitted via touch and is persisted', async ({ page }) => {
          await page.goto(`/board/client.html?token=${project.client_access_token}`);
          const firstSlot = page.locator('.client-song-slot').first();
          await firstSlot.locator('.song-title-input').tap();
          await firstSlot.locator('.song-title-input').fill('Mobile QA Song');
          await page.locator('#songForm button[type="submit"]').tap();
          await expect(page.locator('.toast-success', { hasText: 'Song suggestions submitted' })).toBeVisible();
          await expect(page.locator('.song-title', { hasText: 'Mobile QA Song' })).toBeVisible();
        });

        test('a comment can be posted via touch and is persisted', async ({ page }) => {
          await page.goto(`/board/client.html?token=${project.client_access_token}`);
          await page.locator('#clientCommentBody').tap();
          await page.locator('#clientCommentBody').fill('Mobile QA comment from client');
          await page.locator('#clientCommentForm button[type="submit"]').tap();
          await expect(page.locator('.toast-success', { hasText: 'Comment posted' })).toBeVisible();
          await expect(page.locator('.feed-body', { hasText: 'Mobile QA comment from client' })).toBeVisible();
        });

        test('an invalid token renders the revoked-link message, not a broken form', async ({ page }) => {
          await page.goto('/board/client.html?token=00000000-0000-0000-0000-000000000000');
          await expect(page.locator('#clientProjectHeader .client-muted')).toContainText('invalid or has been revoked');
          await assertNoHorizontalOverflow(page, 'client.html (invalid token)');
        });
      });
    });
  }
});
