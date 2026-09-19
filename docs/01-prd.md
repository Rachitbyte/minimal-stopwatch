# Product Requirements Document (PRD)

## Overview
Tempo is a minimalist, premium web-based stopwatch, countdown, and clock for GitHub Pages. It focuses on aesthetics, smooth animations, and high performance without the bloat of native apps.

## Target Users
Users who need a precise, beautiful, and simple timing tool on their mobile devices or desktop browsers, without installing a native app.

## The Problem
Many web-based timers are cluttered with ads, have poor performance (janky animations), or lack a premium native-like feel.

## Features
- **Modes:** Stopwatch, Countdown, Clock.
- **Stopwatch:** Counts up from 00:00:00.00. Start/Pause/Reset.
- **Countdown:** Counts down to zero from a user-set duration. Start/Pause/Reset. Pulse on completion (no sound/vibration). Input via scroll-wheel picker or typed digits.
- **Clock:** Displays local time. Fullscreen toggle.
- **Gestures:** Tap to start/pause, swipe to switch modes.
- **Keyboard Shortcuts:** Full keyboard support for all actions.
- **Resilience:** Accurate time tracking across tab hides and reloads using timestamp computation.

## MVP Scope
The MVP includes exactly the three modes specified, the smooth digit-roll animation engine, offline/background resilience via `localStorage`, mobile-first responsive design, and keyboard shortcuts.

## Success Metrics
- 0 dropped frames in DevTools Performance recording (60/90/120 fps depending on device).
- Lighthouse score: Performance ≥ 95, Accessibility ≥ 95, Best Practices ≥ 95.
- Visually perfect and fully functional at 320px width up to 4K.

## Out of Scope
- Lap/split times
- Multiple concurrent timers
- Sound / Vibration
- User accounts / Backend / Analytics
- Light theme
- Settings screen
- Push notifications
