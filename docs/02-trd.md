# Technical Requirements Document (TRD)

## Stack
- **Build Tool:** Vite (fast, zero-config for basic vanilla TS).
- **Language:** TypeScript (Vanilla). No frameworks to eliminate overhead and maintain complete control over the render loop.
- **Styling:** Plain CSS with CSS Variables (design tokens).
- **Testing:** Vitest (unit tests for timing logic), Playwright (optional UI smoke tests).

## Architecture
Client-side only. 
- **State Store:** Manages current mode, running status, and timestamps.
- **Timing Engine:** Calculates exact elapsed/remaining time based on `performance.now()` and `Date.now()`.
- **Render Loop:** Single `requestAnimationFrame` loop that updates DOM elements only when their values change.
- **Storage:** Persists state to `localStorage` (`tempo:v1`) on changes and `pagehide`.

## Timing Engine Rules
- Compute, never count ticks.
- Use `requestAnimationFrame` for visually updating time.
- Stop the loop when idle, paused, or tab is hidden (`visibilitychange`).
- When tab becomes visible again, instantly recompute time to prevent visual jumps.
- DOM nodes are cached. Only `transform` and `opacity` are animated.

## Performance Budget
- **Target:** Native device refresh rate (60Hz, 90Hz, 120Hz) with 0 dropped frames.
- **Bundle Size:** Minimal, as there are no large dependencies. Font files (`Geist`, `Geist Mono`) will be subset and self-hosted.

## Security
- No user data collected.
- Simple `localStorage` try/catch for robust state recovery.

## Deployment
- GitHub Actions workflow building the Vite app and deploying to GitHub Pages.
