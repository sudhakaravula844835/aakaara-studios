# QA check — 2026-09-27

Reviewed commit `d89759f` (Board: delete button on project detail panel). No application code changed.

## Findings

1. **Medium — Mobile detail-panel Close button is pushed off-screen.** In `board/board.css:246–252`, the header keeps the title and nonshrinking action group on one row. At a 375px viewport, the title “Alexandra & Christopher” places the Close button at x=374.8 through x=404.8. The panel scroll width is 404px. Reproduced with the current board HTML, both production stylesheets, and loaded fonts, with scripts removed to isolate layout. Allow actions to wrap or place them below the title. Screenshot: [board-mobile-overflow.png](board-mobile-overflow.png).

2. **Low — Seven quote-tracking unit tests are omitted from the default test commands.** `vitest.config.mjs:6` includes only `*.test.js`; `tests/unit/quote-tracking.test.mjs` uses Node's test runner. Add its separate Node test command to the npm test pipeline. All seven pass when run explicitly.

## Verification

- `npx playwright test --reporter=line --workers=4`: **118 passed**, 2.8 minutes. Includes authenticated board desktop/mobile, client portal, intake, quotes, gallery and video controls. Chromium only; mobile coverage uses emulation.
- `node --test tests/unit/quote-tracking.test.mjs`: **7 passed**.
- Additional 390px homepage smoke check: no uncaught page JavaScript errors, document width equals viewport width. Screenshot: [home-mobile.png](home-mobile.png).
- `npm run test:unit`: **inconclusive**. No tests executed; 21 worker-start errors after 120 seconds. A threads retry did not produce results. A two-worker retry outside the sandbox also stalled and was stopped. This is a runner/environment limitation, not evidence that application assertions failed.
- Graph review found no direct tests for the new delete confirmation handler. Its confirmation timeout, delete failure, and successful cleanup paths remain a coverage gap.

## Scope limits

This check does not establish a clean unit-suite result or a successful end-to-end project deletion. No deployment was performed.
