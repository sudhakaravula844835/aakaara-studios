# Aakaara Site QA Test Plan and Execution Report

Date: 2026-04-22
Environment: local static server at `http://127.0.0.1:5173`, Chromium headless via Playwright, macOS local workspace.
Scope: root static site, public HTML pages, tools pages, admin utility pages, existing automated tests, and nested `gallery-preview` Next.js build.

## Summary

| Area | Result |
| --- | --- |
| Existing Vitest unit suite | PASS, 2/2 tests passed; runtime error logged during setup |
| Existing Playwright e2e/mobile suite | PASS, 18/18 tests passed |
| Ad hoc browser crawl | PASS WITH DEFECTS, 20 pages checked |
| Internal link check | PASS, 99 internal links checked |
| Local asset check | FAIL, missing assets found |
| Workflow checks | PASS WITH DEFECTS, 10 workflow checks executed |
| Responsive overflow check | FAIL, desktop home page has horizontal overflow |
| Nested `gallery-preview` build | PASS after allowing network font fetch; warning remains |

Severity definitions:

| Severity | Definition |
| --- | --- |
| Critical | Security, data exposure, or release-blocking defect |
| High | User-visible breakage, broken asset, runtime error, or layout defect |
| Medium | Accessibility, SEO, test reliability, or admin usability issue |
| Low | Cleanup, metadata, warnings, or non-blocking polish |

## Commands Executed

| Command | Result | Notes |
| --- | --- | --- |
| `npm test` | PASS | First sandboxed run could not bind the Playwright server; escalated rerun passed |
| `vitest run` | PASS | 2 tests passed, but jsdom logged `pathEl.getTotalLength is not a function` |
| `playwright test` | PASS | 18 tests passed |
| Browser QA sweep via `/tmp/aakaara_qa_sweep.js` | PASS WITH DEFECTS | 20 pages, 99 links, 77 assets, 7 workflows, 15 responsive checks |
| Admin workflow via `/tmp/aakaara_admin_workflow.js` | PASS | Login, quick import, and quote preview tested with sample data |
| `npm run build` in `gallery-preview` | PASS | First run failed because sandbox blocked Google font fetch; escalated rerun passed |

## Test Data Used

| Area | Data |
| --- | --- |
| Public contact form | Name: `QA Test User`; Email: `qa-test@example.com`; Event: `Wedding`; Message: `QA test inquiry for a wedding shoot in NYC.` |
| Admin quote import | Name: `Priya Shah`; Email: `priya@example.com`; Location: `Central Park, NYC`; Events: `July 4th engagement (4 hours)`, `Aug 15th Haldi (4 hours)`, `Aug 16th Wedding Ceremony (6 hours)` |
| Admin quote expected output | 3 days parsed, 14 total hours, event type `Wedding Photography`, total `$4,200` |

## Executed Test Cases

| ID | Test case | Expected | Actual | Status | Solution / next action |
| --- | --- | --- | --- | --- | --- |
| AUT-001 | Run full repo test command | Unit and e2e suites complete | 20 total automated tests passed | PASS | Keep in CI |
| AUT-002 | Unit test: couple portrait location guide default state | First location active | First location active | PASS | Fix jsdom runtime error listed in DEF-005 |
| AUT-003 | Unit test: couple portrait location hover | Hover activates matching preview | DUMBO hover activated matching preview | PASS | Keep coverage |
| E2E-001 | Home intro and hero | Intro hides and hero appears | Passed | PASS | Keep coverage |
| E2E-002 | Portfolio filter | Wedding filter shows wedding items and hides maternity | Passed | PASS | Keep coverage |
| E2E-003 | Portfolio gallery modal | First gallery item opens viewer | Passed | PASS | Keep coverage |
| E2E-004 | Nav smooth scroll | Portfolio nav scrolls into section | Passed | PASS | Keep coverage |
| E2E-005 | Contact valid submit | Mocked Formspree success redirects to thank-you | Passed | PASS | Keep coverage |
| E2E-006 | Honeypot bot protection | Honeypot prevents network request | Passed | PASS | Add ARIA/label cleanup for hidden honeypot |
| E2E-007 | Mobile hero on iPhone SE and Pixel 7 | Hero visible, no wordmark overflow | Passed | PASS | Keep coverage |
| E2E-008 | Mobile video carousel controls | Coverflow and video modal controls work | Passed | PASS | Keep coverage |
| E2E-009 | Mobile date/input behavior | Native date field and 16px inputs | Passed | PASS | Keep coverage |
| E2E-010 | Film modal close behavior | Heavy libs deferred; scroll preserved | Passed | PASS | Keep coverage |
| E2E-011 | Mobile/tablet swipe suppression | Swipe does not immediately open a film | Passed | PASS | Keep coverage |
| CRAWL-001 | Load all discovered HTML pages | Pages return HTTP 200 | 20 pages returned 200 | PASS | Exclude fragments/templates from public crawl or add noindex |
| LINK-001 | Check internal anchors | Internal links resolve | 99 links checked; no failing internal links found | PASS | Keep periodic crawl |
| ASSET-001 | Check local DOM assets | Local assets resolve | Missing assets found | FAIL | Fix DEF-002 |
| SEO-001 | Check title, description, H1 basics | Public pages have useful metadata | Several pages/tools missing descriptions; `gallery-preview` metadata is scaffold | FAIL | Fix DEF-007 |
| A11Y-001 | Check image alt text | Meaningful images have alt text | Tool QR/base64 images missing alt | FAIL | Add `alt` or decorative `alt=""` |
| A11Y-002 | Check buttons have accessible names | Buttons expose names | Dashboard icon buttons lack names | FAIL | Fix DEF-006 |
| A11Y-003 | Check form controls have labels | Inputs/selects/textareas associated with labels | Admin controls and a few public controls lack explicit labels | FAIL | Fix DEF-006 |
| RESP-001 | Check home at 375px, 768px, 1440px | No horizontal overflow | 1440px desktop overflows by 428px | FAIL | Fix DEF-003 |
| RESP-002 | Check couple portraits at 375px, 768px, 1440px | No horizontal overflow | No overflow found | PASS | Keep coverage |
| RESP-003 | Check share-your-experience at 375px, 768px, 1440px | No horizontal overflow | No overflow found | PASS | Keep coverage |
| RESP-004 | Check pricing couples at 375px, 768px, 1440px | No horizontal overflow | No overflow found | PASS | Keep coverage |
| RESP-005 | Check admin quote generator at 375px, 768px, 1440px | No horizontal overflow | No overflow found while locked | PASS | Add logged-in responsive coverage |
| WF-001 | Home hero is visible | Hero/home section visible | Passed | PASS | Keep coverage |
| WF-002 | Portfolio wedding filter | Wedding visible, non-matching items hidden | Passed | PASS | Keep coverage |
| WF-003 | Contact empty submit | Browser validation prevents submit | Passed | PASS | Keep coverage |
| WF-004 | Contact valid submit | Mocked submit redirects to thank-you | Passed | PASS | Keep coverage |
| WF-005 | Couple portraits location hover | DUMBO location becomes active | Passed | PASS | Keep coverage |
| ADM-001 | Admin quote login | Correct test access code unlocks app | Passed | PASS | Replace client-side auth; see DEF-001 |
| ADM-002 | Admin quote quick import | Sample brief parses into fields/days/total | Passed | PASS | Keep as regression test |
| ADM-003 | Admin quote preview | Preview opens after imported data | Passed | PASS | Add PDF content assertions |
| GP-001 | `gallery-preview` production build | Build completes | Passed after network access; workspace root warning remains | PASS WITH WARNING | Fix DEF-008 |

## Defects

| ID | Severity | Defect | Evidence | Impact | Recommended solution |
| --- | --- | --- | --- | --- | --- |
| DEF-001 | Critical | Admin access code is shipped in client-side source | `admin/quote-generator.js:2` has `accessCode`; `admin/contract-generator.html:830` has `ACCESS_CODE` | Anyone can view source and unlock admin quote/contract tools if `/admin` is publicly deployed | Move auth server-side. Protect `/admin/*` with platform auth, basic auth at edge, Netlify/Vercel middleware, or an authenticated server function. Do not ship passwords in JS/HTML. |
| DEF-002 | High | Missing local assets in tool pages | `tools/insta-carousel.html` uses `favicon.svg`, resolving to `/tools/favicon.svg`; `tools/views-story.html` references missing `./assets/instagram-insights.jpg` and CSS references `./assets/instagram-feed-grid.jpg`; `tools/assets/` does not exist | Tool pages show broken images and log 404 errors | Change carousel references to `/favicon.svg` or `../favicon.svg`. Add the missing story assets under `tools/assets/` or update paths to existing images. |
| DEF-003 | High | Desktop home page has horizontal overflow | Browser check at 1440px found `documentElement.scrollWidth=1868`; overflowing elements are offscreen `.vw-card` items in `#videoCarousel` | Users can get unwanted horizontal scrolling; layout metrics and screenshots are unstable | Clip the carousel layout at the carousel/section boundary. Add `overflow: hidden` and possibly `contain: layout paint` to `.ethereal-carousel` or `#videoCarousel`; ensure hidden cards cannot expand document scroll width. |
| DEF-004 | High | WebGL pages throw uncaught errors when WebGL context cannot be created | `experience-3d.js:14`; `animation_check.html:116`; Playwright logged `Error creating WebGL context` | 3D enhancements can fail loudly on low-end devices, disabled WebGL, or headless/locked-down browsers | Feature-detect WebGL before creating `THREE.WebGLRenderer`, wrap renderer creation in `try/catch`, and show a non-WebGL fallback instead of throwing. |
| DEF-005 | Medium | Unit tests pass but log a runtime error | `location-guide.test.js` logs `pathEl.getTotalLength is not a function` from `couple-portraits.html:2497` | Test output is noisy and could hide real failures | In test setup, stub `SVGPathElement.prototype.getTotalLength`. In production code, guard before calling the method and fall back to a default path length. |
| DEF-006 | Medium | Accessibility label issues across admin/public controls | QA sweep found unlabeled controls in `admin/contract-generator.html`, `admin/quote-generator.html`, `admin/dashboard.html`, public contact `dateTo`, honeypot `_gotcha`, and dashboard icon buttons `btn-copy`/`btn-delete` | Screen reader users and keyboard users get poor context; automated a11y checks will fail | Add `for`/`id` label associations or `aria-label` to controls. Add `aria-label="Copy quote"` and `aria-label="Delete quote"` to dashboard icon buttons. Mark honeypot hidden from assistive tech with `aria-hidden="true"` and `tabindex="-1"`. |
| DEF-007 | Medium | SEO/metadata coverage is incomplete | Missing descriptions on `share-your-experience.html`, animation studies, logo page, many tools; `gallery-preview/app/layout.tsx` uses `Create Next App`; sitemap only lists `/` and `/couple-portraits.html` | Search previews are generic or missing; public pages may be excluded from sitemap | Add page-specific metadata for public pages. Update `gallery-preview` title/description. Expand sitemap only with intended public URLs; add `noindex` for internal tools/admin/templates. |
| DEF-008 | Low | `gallery-preview` build warns about inferred workspace root | `next build` selected root package lock and detected nested lockfile | Future Next/Turbopack behavior may be unstable in monorepo-like layout | Set `turbopack.root` in `gallery-preview/next.config.ts` or consolidate lockfile/workspace structure intentionally. |
| DEF-009 | Low | Netlify config says no build while repo contains a nested Next app | `netlify.toml` publishes `.` with no build | If `gallery-preview` is meant to ship, it is not included in the static deployment workflow | Decide whether `gallery-preview` is a prototype or deploy target. If deploy target, add a real build/publish setup or move it to a separate project. |

## Recommended Regression Additions

| Priority | Test to add |
| --- | --- |
| High | Playwright test that asserts `document.documentElement.scrollWidth <= clientWidth` on desktop and mobile for all public pages |
| High | Asset crawler that parses HTML and CSS background URLs, not just DOM assets |
| High | Admin route security check in deployment QA: `/admin/*` must be protected by server/platform auth |
| Medium | WebGL fallback test by forcing renderer creation failure and asserting no uncaught page error |
| Medium | Accessibility smoke test for labels, button names, alt text, and keyboard focus |
| Medium | Logged-in admin quote generator e2e test with sample import and preview/PDF assertions |
| Low | Sitemap/robots metadata check for intended public URLs only |

## Release Recommendation

Do not treat this as production-ready until DEF-001 is resolved if `/admin/*` is deployed publicly. For the public marketing site, the current automated user workflows pass, but fix DEF-002, DEF-003, and DEF-004 before a polished release.
