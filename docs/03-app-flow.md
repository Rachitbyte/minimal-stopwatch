# App Flow

## Global UI Structure
- **Top:** Mode Switcher (Stopwatch | Countdown | Clock)
- **Center:** Main Time Display
- **Bottom:** Controls (Start/Pause, Reset)

## Modes & States

### 1. Stopwatch Mode
- **Idle State:** Displays `00:00:00.00` at reduced opacity.
  - Buttons: [Start] (Primary)
- **Running State:**
  - Time counts up. Digits roll smoothly.
  - Buttons: [Pause] (Secondary)
- **Paused State:**
  - Time frozen.
  - Buttons: [Start] (Primary), [Reset] (Secondary)

### 2. Countdown Mode
- **Input State:**
  - UI shows either Scroll-Wheel Picker or Typed Digits input.
  - User sets duration.
  - Buttons: [Start]
- **Running State:**
  - Time counts down.
  - Buttons: [Pause]
- **Paused State:**
  - Time frozen.
  - Buttons: [Start], [Reset]
- **Done State:**
  - Displays `00:00:00.00`.
  - Display pulses (scale/opacity).
  - Dismiss via tap anywhere, key press (Esc/Space), or Reset button.

### 3. Clock Mode
- Displays current local time.
- No controls except a fullscreen toggle button (desktop).

## Gestures & Interactions
- **Tap time display:** Start/Pause (Stopwatch & Countdown).
- **Swipe left/right:** Switch modes (disabled during picker scroll).
- **Keyboard Shortcuts:** Space (Start/Pause), R (Reset), 1/2/3 (Switch Mode), Arrows (Adjust countdown/mode), F (Fullscreen), Esc (Dismiss pulse/fullscreen), ? (Help overlay).

## Background/Reload Flow
- If closed while running, re-opening calculates elapsed time from stored timestamp and resumes visually.
- If countdown reaches zero while closed, re-opening immediately shows "Done State" (pulse).
