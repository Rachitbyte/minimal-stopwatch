# Implementation Plan

## Phase 1: Project Setup (Empty Shell)
- **Tasks:** Initialize Vite vanilla-ts project. Set up `index.css` with color/typography tokens. Add `Geist` fonts. Create base HTML layout. Set up GitHub Actions deploy pipeline to GH Pages.
- **Deliverable:** Live blank page on GH Pages with correct background color and font loaded.

## Phase 2: Core Engine & Persistence
- **Tasks:** Implement `localStorage` state manager. Build the timestamp-based timing engine and `requestAnimationFrame` loop.
- **Tests:** Vitest specs for compute functions, state transitions, pause/resume logic, and offline-completion detection.

## Phase 3: Stopwatch UI
- **Tasks:** Build the rolling digits DOM structure. Implement `transform` logic with wrapping (9->0). Wire up Start/Pause/Reset buttons.
- **Deliverable:** Fully functional stopwatch.
- **Tests:** Visual check for zero dropped frames and no layout shifts during rolls.

## Phase 4: Countdown UI
- **Tasks:** Build scroll-wheel picker and typed input logic. Implement the countdown mode and completion pulse.
- **Deliverable:** Functional countdown mode.
- **Tests:** Verify input persistence. Verify pulse triggers correctly upon reaching 0, even if tab was in background.

## Phase 5: Clock & Gestures
- **Tasks:** Build clock mode. Add mode switcher segmented control. Implement swipe left/right and tap-to-start gestures.
- **Deliverable:** All three modes accessible via UI and gestures.

## Phase 6: Keyboard & System Integration
- **Tasks:** Add keyboard event listeners. Implement Fullscreen API toggle. Add Wake Lock API. Add Web Manifest and Apple Touch Icons.
- **Tests:** Verify shortcuts. Verify Add to Home Screen behavior on iOS/Android if possible.

## Phase 7: Polish & Quality Assurance
- **Tasks:** Accessibility sweep (ARIA roles, keyboard focus). Add `prefers-reduced-motion` logic. Run DevTools performance trace. Run Lighthouse.
- **Deliverable:** Polished product.
- **Tests:** Lighthouse scores ≥ 95.

## Phase 8: Final Release
- **Tasks:** Final code cleanup, ensure `brain/` docs are perfectly synced with reality. Report completion.
