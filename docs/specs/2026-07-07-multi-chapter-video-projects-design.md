# Multi-Chapter Video Projects — Design Spec

Date: 2026-07-07

## Problem

Indian/South Indian weddings are shot as multiple distinct films per project
(Haldi, Sangeet, Wedding, etc.). Today each film is its own `.vw-card` in
`#vwGrid`, so a single wedding with 3 films eats 3 grid slots (e.g. the
existing "Abhinav & Megha" Wedding + Pre-Wedding cards). This clutters the
Video Works grid and disconnects films that belong to the same event.

## Goal

Show one grid tile per wedding **project**. If that project has more than
one film, clicking the tile opens the existing video modal with a way to
switch between the project's films (Haldi / Sangeet / Wedding / …) without
leaving the modal.

## Non-goals

- No changes to `filterVideos()`, `EtherealCarousel`, or the poster
  hover-preview system — they only ever operate on the outer `.vw-card`,
  and this design keeps that contract intact.
- No auto-playing stitched reel across events (rejected approach — more
  work, needs chapter timestamp tracking, not needed here).
- No mini-gallery picker step before playback (rejected approach — adds an
  extra click before watching).

## Design

### 1. Markup — nested chapters, backward-compatible

`.vw-card` keeps its normal `data-video` / `data-type` / `data-title` /
`data-poster`, pointed at the hero/default film (e.g. the Wedding film).
This means every existing single-video card (~25 of them) needs **zero**
changes — hover-preview (`aakaaraStopVideoWorkPreviews`, `posterObserver`),
`filterVideos`, and `EtherealCarousel` all read `card.dataset.video` /
`card.dataset.vcat` off the card itself and are untouched.

A multi-event project adds a `.vw-chapters` block inside the card, one
`.vw-chapter` button per film:

```html
<div class="vw-card wide vw-gi-2" data-vcat="wedding"
     data-video="https://.../wedding.m3u8"
     data-title="Priya & Arjun" data-type="Wedding Film"
     data-poster="/images/video-covers/wedding/priya-arjun/cover.jpg">
  <!-- existing .vw-poster / .vw-play-wrap / .vw-overlay / .vw-duration markup unchanged -->

  <div class="vw-chapters">
    <button class="vw-chapter active" data-label="Haldi"   data-video="https://.../haldi.m3u8"   data-type="Haldi Film"></button>
    <button class="vw-chapter"        data-label="Sangeet" data-video="https://.../sangeet.m3u8" data-type="Sangeet Film"></button>
    <button class="vw-chapter"        data-label="Wedding" data-video="https://.../wedding.m3u8"  data-type="Wedding Film"></button>
  </div>
</div>
```

`.vw-chapters` is visually hidden in the grid (`display:none` via CSS) —
it exists purely as a data source read by JS when the modal opens.

### 2. Card visual — auto-computed "N Films" badge

On init, JS counts each card's `.vw-chapter` children and injects a badge
(e.g. `3 Films`) onto the poster corner. The count is derived, not
hand-typed, so it can't drift out of sync when a 4th event is added later.
Cards with no chapters get no badge — identical to today.

```css
.vw-badge-count {
  position: absolute; top: 0.75rem; right: 0.75rem;
  background: rgba(24,21,24,0.68);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  color: var(--ivory); font-size: 0.7rem; padding: 0.3rem 0.6rem; border-radius: 999px;
}
```

### 3. Modal — chapter tabs, swap-in-place

`vm-header` gets a new tab row, hidden by default, populated per-card in
`openModal(card)`:

- Query `card.querySelectorAll('.vw-chapter')`. If none exist, tab row
  stays hidden and modal behavior is 100% identical to today.
- If chapters exist: render one pill per chapter using `data-label`; mark
  the one with class `active` (or the first) as selected; load **that
  chapter's** `data-video` / `data-type` into the modal instead of the
  card's own `data-video` — so the modal opens already playing the default
  chapter (e.g. Haldi).
- Clicking a different pill re-runs the existing `attachHLS` swap path
  (same teardown/attach logic already used on open) and updates
  `vmSub`/`vmTitle` type text. No new video-loading code required.
- `closeModal()` requires no changes; reopening a card always resets to
  its default chapter.

### 4. Filtering / carousel / hover-preview — unchanged

Because `data-vcat`, `data-video`, and `data-title` remain on the outer
`.vw-card`, `filterVideos()`, `EtherealCarousel` indexing, and the hover
poster-preview system require no code changes at all.

## Testing

- Existing Playwright video-works coverage must keep passing unmodified
  (proves single-video cards are unaffected).
- New test(s): a card with `.vw-chapters` opens the modal on the default
  chapter, tab row renders with correct labels/count, clicking a tab swaps
  the video source and updates the subtitle, and the badge count matches
  the number of chapters.

## Rollout

Retrofit is optional/incremental — existing single-film cards need no
migration. When the user has a new multi-event wedding to add, they author
one `.vw-card` with a `.vw-chapters` block instead of N separate cards.
