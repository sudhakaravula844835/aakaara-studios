# Implementation Plan: Cinematic Carousel Animations

**Reference Spec:** `docs/superpowers/specs/2026-04-01-carousel-animations-design.md`
**Target File:** `tools/insta-carousel.html`

## Phase 1: CSS Foundation (Completed)
- [x] Add `@keyframes` for `wipeUp`, `fadeUp`, `fadeIn`, and `lineGrow` to the internal `<style>` block.
- [x] Set initial state `opacity: 0` for all target elements (marks, headlines, text blocks) to prevent them from flashing before the animation starts.
- [x] Implement `.slide.is-visible` child selectors with specific `animation-delay` and `animation-duration` values for all 6 slides as per the spec.

## Phase 2: HTML Refinement (Completed)
- [x] **Slide 02**: Locate the `.pron` element and insert a new `<div class="slide-02-divider"></div>` immediately after it.
- [x] **Slide 03**: Refactor the `.headline` content into two `<span class="hl-line">` elements to allow for staggered cinematic wipes.

## Phase 3: JavaScript Controller (Completed)
- [x] Initialize an `IntersectionObserver` at the bottom of the `<script>` block with a `threshold` of `0.2`.
- [x] Implement the observer callback to toggle the `.is-visible` class and stop observing the element once triggered.
- [x] Loop through all `.slide` elements and register them with the observer.

## Phase 4: Quality Assurance (Completed)
- [x] Serve the tool locally and verify the "Style A" (Wipe) and "Style B" (Stagger) animations trigger correctly on scroll.
- [x] Confirm `animation-fill-mode: forwards` is correctly applied so elements remain visible after animating.
- [x] Test the download functionality to ensure the visual animations do not interfere with the `html2canvas` export.
- [x] Manually verify and re-apply failed code hunks in `tools/insta-carousel.html`.
- [x] Verified Slide 02 divider and Slide 03 headline spans for cinematic motion.