# master.md — Tempo (working title)

A minimalist, premium stopwatch / countdown / clock **website** for GitHub Pages. Phone-first, desktop-supported. Not a native app.

This file is the single source of truth. Read it fully before doing anything.

---

## 0. Operating rules (read first)

1. **Two phases, hard gate.** Phase 1 = design and plan (documents only, no app code). Phase 2 = build. **Do not start Phase 2 until the owner writes "approved".**
2. **Do not add features** that are not listed here. If something is unclear, make a reasonable assumption, write it in `brain/decisions.md`, and continue. Ask only if truly blocked.
3. **Quality over speed.** Every acceptance criterion in section 12 must pass before the work is called done.
4. **Be honest in reports.** If something cannot be done (see section 11), say so. Never claim a result you did not measure.
5. After every phase, update the `brain/` files (section 1) and report what changed.

---

## 1. Step 0 — Create the `brain/` folder

Before anything else, create `brain/` at the repo root with these five files:

| File | Contents |
|---|---|
| `master-memory.md` | Project summary, current phase, what is done, what is next, key links. Update after every phase. |
| `architecture.md` | Folder structure, module responsibilities, data flow, timing engine design. |
| `patterns.md` | Coding conventions, naming, CSS token rules, animation patterns, reusable snippets. |
| `decisions.md` | Every technical or design decision with the reason and date. Include assumptions. |
| `mistakes.md` | Bugs hit, wrong approaches tried, and the fix. Read this before repeating similar work. |

Read all five at the start of every session. Update them at the end.

---

## 2. Phase 1 — Design and plan

Create a `docs/` folder with the six documents below. Use sections 3–10 of this file as the locked input; expand it into detailed, structured, buildable documents. Do not contradict this file.

| # | Document | File | Notes |
|---|---|---|---|
| 1 | Product Requirements (PRD) | `docs/01-prd.md` | Overview, users, problem, features, user stories, MVP scope, success metrics, out-of-scope. |
| 2 | Technical Requirements (TRD) | `docs/02-trd.md` | Stack with reasons, architecture, timing engine, performance budget, security, deployment. |
| 3 | App Flow | `docs/03-app-flow.md` | Every screen and state, every button/gesture/key behavior, empty/error/success states. |
| 4 | UI/UX Design Brief | `docs/04-ui-ux-brief.md` | Tokens (color, type, spacing, motion), component styles, layouts for mobile/desktop, ASCII wireframes. |
| 5 | Data Schema | `docs/05-data-schema.md` | **No backend.** Define the client-side state model and `localStorage` schema (section 6). |
| 6 | Implementation Plan | `docs/06-implementation-plan.md` | Phased build order with deliverables and tests per phase. |

Then produce a short **understanding summary**: what you understood, missing details, risks, and the build plan. **Stop and wait for "approved".**

---

## 3. Product scope

**Modes (three only):**
1. **Stopwatch** — counts up from 00:00:00.00.
2. **Countdown** — counts down from a user-set duration to zero.
3. **Clock** — shows the current local time.

**Not included:** lap/split times, multiple timers, sound, vibration, accounts, backend, analytics, light theme, settings screen.

**Display format:** `HH:MM:SS.cc` where `cc` = centiseconds (2 digits).

**Controls per mode:**
- Stopwatch: Start / Pause / Reset.
- Countdown: set duration, Start / Pause / Reset.
- Clock: no controls (fullscreen toggle only).

---

## 4. Timing engine (critical)

- **Never count ticks.** Time is always computed from timestamps.
- Use `performance.now()` for on-screen elapsed time and `Date.now()` for anything persisted.
- Stopwatch: `elapsed = accumulatedMs + (now - startedAt)` while running.
- Countdown: `remaining = max(0, durationMs - elapsed)`. Completion fires when `remaining` reaches 0.
- One `requestAnimationFrame` loop drives all visuals. Stop the loop when nothing is animating (paused, idle) and when the tab is hidden.
- On `visibilitychange` (returning to the tab) recompute from timestamps immediately, so the display is correct on the first frame.
- Cache all DOM references. No layout reads in the frame loop. No `innerHTML` per frame. Update a digit's DOM only when its value changes (centiseconds change every frame, so treat them as the only always-updating element).

---

## 5. Animation spec (the memorable part)

This is the one place to spend boldness. Everything else stays quiet.

- **Hours, minutes, seconds:** each digit is a vertical strip (0–9). When a digit changes, the strip rolls smoothly with `transform: translateY(...)`, ~300–400 ms, a soft ease-out (custom cubic-bezier, no bounce). Handle wrap (9→0, 5→0) so the roll always moves in one direction, never rewinding visibly.
- **Centiseconds:** update continuously every frame, no roll. Rendered slightly smaller and dimmer than the main digits so it reads as motion, not noise.
- **Only `transform` and `opacity`** may be animated. No animating `top/left/width/height/font-size/box-shadow/filter` on the timer.
- Use `will-change: transform` only on the digit strips. Use `contain: layout paint` on the display.
- Digits use **tabular figures** and fixed-width cells so nothing shifts horizontally, ever.
- **Completion (countdown reaches zero):** the time display pulses (opacity + a very subtle scale, ~1.4 s loop, ease-in-out) until the user taps, presses a key, or resets. **No sound. No vibration.** With `prefers-reduced-motion`, use a slow opacity fade only.
- Button and mode-switch feedback: short (120–180 ms) opacity/scale response to touch. No hover-lift effects, no entrance animations on load.
- **Refresh rate:** target the display's native refresh rate (60/90/120 Hz). Do not hardcode 120 fps. Success = no dropped frames, not a specific number.

---

## 6. State and persistence

Store one `localStorage` key `tempo:v1` (JSON, try/catch on every read/write, fall back to defaults if empty or corrupt):

```json
{
  "version": 1,
  "mode": "stopwatch | countdown | clock",
  "stopwatch": { "status": "idle|running|paused", "accumulatedMs": 0, "startedAtEpoch": null },
  "countdown": { "status": "idle|running|paused|done", "durationMs": 0, "accumulatedMs": 0, "startedAtEpoch": null },
  "countdownInputStyle": "picker | typed"
}
```

**Restore rules on load or return from background:**
- `running` → recompute elapsed from `Date.now() - startedAtEpoch` and keep running as if it never stopped.
- `paused` → restore exact paused value.
- Countdown finished while the page was closed or hidden → open in the `done` state with the pulse.
- Clock mode needs no stored state beyond `mode`.
- Save on every state change and on `pagehide`. Do not write every frame.

---

## 7. Controls and input

**Buttons (mobile-first):** large Start/Pause and Reset, minimum 48×48 px touch targets, thumb-reachable in the lower half of the screen.

**Gestures:**
- Tap the time to start/pause (stopwatch, countdown).
- Swipe left/right on the display area to switch mode.
- Gestures must not fire while the countdown picker is being scrolled.

**Countdown duration input — both, user can switch:**
- **Scroll-wheel picker** (iOS-style) for hours / minutes / seconds using CSS scroll-snap, with smooth inertia.
- **Typed digits** entry (type 1-2-3-0 → 00:12:30 style, calculator-like fill from the right).
- Remember the last used style and last duration.

**Keyboard shortcuts (ignore when focus is in a text input):**

| Key | Action |
|---|---|
| Space | Start / Pause |
| R | Reset |
| 1 / 2 / 3 | Stopwatch / Countdown / Clock |
| ← / → | Previous / next mode |
| ↑ / ↓ | Adjust countdown (when idle): ±1 minute; Shift = 10 s, Alt = 1 hour |
| Enter | Start (countdown, from idle) |
| F | Toggle fullscreen |
| Esc | Dismiss completion pulse / exit fullscreen |
| ? | Show shortcut sheet |

The shortcut sheet is a small, dismissible overlay. Show a subtle hint on desktop only.

---

## 8. Visual design

**Direction:** Minimal, calm, precise. Inspiration: ChatGPT's desktop UI (quiet surfaces, soft borders, generous space) rendered in strict black and white.

- **Palette (only these):** `#000000` background, `#FFFFFF` primary text, `#A3A3A3` secondary text, `#262626` borders/surfaces, `#171717` raised surface. No accent color, no gradients, no colored shadows, no glow.
- **Fonts:** **Geist Mono** for the time digits, **Geist** for UI text. Self-host `woff2` (subset to needed glyphs), `font-display: swap`, preload the digit font. Fallback stacks: `ui-monospace, SFMono-Regular, Menlo, monospace` and `system-ui, sans-serif`.
- **Type scale:** the time is dominant (fluid size with `clamp()`, fits 320 px width without wrapping). Everything else is small and quiet. Sentence case labels. **No all-caps labels, no letter-spaced eyebrows, no decorative dividers.**
- **Layout (mobile portrait):** mode switcher (segmented control, 3 items) at top → time centered vertically → controls in the lower area. Landscape and desktop: same layout, time larger, controls beside/below, max content width so it never feels stretched.
- **Components:** pill buttons with 1 px `#262626` border; primary action is white fill/black text; secondary is outlined. One consistent radius scale. No card grids.
- **Idle state:** zeros shown at reduced opacity until started.
- Copy is short, plain, sentence case ("Start", "Pause", "Reset", "Time's up").

---

## 9. Mobile experience (website that feels native)

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- Use `100dvh`; respect safe-area insets (`env(safe-area-inset-*)`).
- `touch-action: manipulation` to remove double-tap zoom delay; disable text selection and tap highlight on the UI.
- `theme-color` and status bar set to black. Add a web manifest (`display: standalone`, black background) and Apple touch icon so "Add to Home Screen" opens without browser chrome. This is still a website.
- **Screen Wake Lock** while a timer is running; re-acquire on `visibilitychange`; fail silently where unsupported.
- **Fullscreen** button/shortcut using the Fullscreen API. Where unsupported (iPhone Safari), hide the button and rely on Add to Home Screen.
- Portrait-first. Landscape and desktop are fully supported.

---

## 10. Tech stack and deployment

- **Vite + vanilla TypeScript.** No UI framework, no runtime dependencies. Plain CSS with custom properties (design tokens).
- **Tests:** Vitest for the timing engine and persistence logic (start/pause/resume, restore after simulated reload, countdown completion while away, wrap behavior of digit rolls). Optional Playwright smoke test for mobile and desktop viewports.
- **Deployment:** GitHub Pages via a GitHub Actions workflow (build with Vite, deploy `dist`). Set Vite `base` correctly for a project page. The owner does not care how deployment is done; pick the most reliable route.
- Lighthouse (mobile): Performance ≥ 95, Accessibility ≥ 95, Best Practices ≥ 95.

---

## 11. Known platform limits (state these in the docs, do not hide them)

1. **Refresh rate:** a website can only match the screen's refresh rate. A 60 Hz phone shows 60 fps. The goal is zero jank at whatever the display supports.
2. **Background behavior:** browsers pause animation and timers in hidden tabs or locked phones. The displayed time will be exactly correct on return because it is computed from timestamps, but a static GitHub Pages site **cannot alarm or notify while the phone is locked**. That would require push notifications and a server, and is out of scope.
3. **Fullscreen** is not available on iPhone Safari.
4. **Wake Lock** support varies by browser.

---

## 12. Accessibility and acceptance criteria

**Accessibility**
- All controls are real `<button>`s with accessible names; visible `:focus-visible` states; full keyboard operation.
- The ticking time is **not** in an `aria-live` region (it would spam screen readers). Announce only state changes ("Started", "Paused", "Time's up") through a polite live region.
- Contrast of secondary text ≥ 4.5:1 on black.
- `prefers-reduced-motion` respected (section 5).

**The build is done only when all of these pass**
- [ ] Stopwatch, countdown and clock work; no laps, no multi-timer.
- [ ] Display is `HH:MM:SS.cc`; digits never shift layout.
- [ ] Seconds/minutes/hours roll smoothly; centiseconds run continuously.
- [ ] No dropped frames in a DevTools Performance recording (10 s run) on desktop and on a real phone; report the numbers.
- [ ] Reload mid-run restores correct time; leaving the tab for 60 s and returning shows the exact time.
- [ ] Countdown that finishes while away opens in the done state with pulse.
- [ ] Pulse on completion, no sound, no vibration, dismissable by tap and key.
- [ ] Picker and typed input both work and remember the last choice.
- [ ] All keyboard shortcuts in section 7 work; none fire while typing.
- [ ] Works at 320 px width up to 4K; portrait and landscape.
- [ ] Wake Lock and fullscreen behave as specified, with graceful fallbacks.
- [ ] Only the black/white palette is used; fonts are self-hosted.
- [ ] Lighthouse scores meet section 10.
- [ ] Deployed and live on GitHub Pages; URL reported.
- [ ] `brain/` files are current.

---

## 13. Phase 2 — Build order (summary; full detail goes in the implementation plan)

1. Project setup, tokens, fonts, base layout, deploy pipeline (empty shell live on Pages).
2. Timing engine + persistence + unit tests (no UI polish yet).
3. Stopwatch UI with digit-roll animation and continuous centiseconds.
4. Countdown: picker, typed input, completion pulse.
5. Clock mode, mode switcher, swipe gestures.
6. Keyboard shortcuts, fullscreen, Wake Lock, manifest/PWA meta.
7. Accessibility pass, reduced motion, cross-device performance tests, Lighthouse.
8. Final polish, cleanup, deploy, report.

Build phase by phase. After each phase: run tests, update `brain/`, summarize, then continue.

---

## 14. First message to send back after reading this file

> I have read master.md. I will create the `brain/` folder and the six documents in `docs/`, then send you a summary of what I understood, any missing details, and the build plan. I will not write app code until you say "approved".
