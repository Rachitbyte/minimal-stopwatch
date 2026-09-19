# Architecture

**Folder Structure:** (Planned)
- `src/`
  - `components/` - UI elements (buttons, timer display, mode switcher, picker, keypad)
  - `engine/` - Timing logic, timestamp calculations, `requestAnimationFrame` loop
  - `store/` - State management and `localStorage` persistence
  - `styles/` - Design tokens (`index.css`), component CSS
  - `utils/` - Helpers (formatting time, parsing)
  - `main.ts` - Entry point, initialization

**Module Responsibilities:**
- **Engine:** Pure functions for time computation (`elapsed = accumulatedMs + (now - startedAt)`). `requestAnimationFrame` driver.
- **Store:** Reads/writes to `tempo:v1` in `localStorage` on state changes and `pagehide`. Provides the current state to the UI.
- **UI:** Subscribes to store/engine. Renders DOM elements, handles interactions, and applies CSS transforms (`translateY`) based on time values.

**Data Flow:**
User Input (Gestures, Buttons, Keyboard) -> Store (Update State) -> Engine (Start/Stop Loop) -> UI (Render/Update `transform`)

**Timing Engine Design:**
- Never count ticks. Recompute elapsed time from timestamps (`performance.now()` for animation, `Date.now()` for persistence).
- One global `requestAnimationFrame` loop drives all visuals. Stop when idle or hidden.
- `visibilitychange` recomputes from timestamps instantly.
- Cache DOM references. Only update DOM/transforms when the specific digit changes.
