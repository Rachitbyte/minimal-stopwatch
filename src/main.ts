import './style.css';
import {
  loadState,
  saveState,
  loadSpokenRemindersEnabled,
  saveSpokenRemindersEnabled
} from './store';
import type { TempoMode } from './store';
import { getStopwatchElapsed, getCountdownRemaining } from './engine/time';
import { getTabTitle } from './engine/title';
import { startLoop, stopLoop, subscribeToLoop } from './engine/loop';
import { startBackgroundTicker, stopBackgroundTicker, subscribeToBackgroundTick } from './engine/backgroundTicker';
import { registerNotificationServiceWorker, requestCountdownNotificationPermission, notifyCountdownDone } from './engine/notifications';
import { CountdownReminderTracker } from './engine/countdownSchedule';
import { SpeechSpeaker, isSpeechSupported } from './engine/speech';
import { unlockCompletionAudio, playCompletionSound } from './engine/sound';
import { TimeDisplay } from './components/TimeDisplay';
import { CountdownInput } from './components/CountdownInput';
import { CountdownClock } from './components/CountdownClock';
import { FloatingTimer, isDocumentPiPSupported, type FloatingTimerSnapshot } from './components/FloatingTimer';
import { MobileFloatingTimer, isVideoPiPSupported } from './components/MobileFloatingTimer';

const VOICE_ON_ICON = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
`;

const VOICE_OFF_ICON = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="22" y1="9" x2="16" y2="15" />
    <line x1="16" y1="9" x2="22" y2="15" />
  </svg>
`;

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="mode-switcher">
    <button data-mode="stopwatch">Stopwatch</button>
    <button data-mode="countdown">Countdown</button>
    <button data-mode="clock">Clock</button>
  </header>
  <main class="time-container">
    <div class="clock-date" style="display: none;"></div>
  </main>
  <footer class="controls">
    <span class="controls-spacer" aria-hidden="true"></span>
    <button id="btn-voice" class="secondary icon-btn voice-btn" type="button" aria-label="Spoken countdown reminders on" aria-pressed="true" title="Spoken reminders: On" style="display: none;">
      ${VOICE_ON_ICON}
    </button>
    <button id="btn-reset" class="secondary" style="display: none;">Reset</button>
    <button id="btn-start" class="primary">Start</button>
    <button id="btn-float" class="secondary icon-btn float-btn" type="button" aria-label="Open floating timer" aria-pressed="false" title="Float timer">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="14" rx="2.5" />
        <rect x="11.5" y="10.5" width="7.5" height="5.5" rx="1.2" fill="currentColor" stroke="none" />
      </svg>
    </button>
  </footer>
  <div id="toast-message" class="toast-message" role="status" aria-live="polite" style="display: none;"></div>
  <button id="btn-fullscreen" aria-label="Enter fullscreen" class="fullscreen-btn" title="Fullscreen" style="display: none;">
    <span class="fs-enter">Full Screen</span>
    <span class="fs-exit" style="display: none;">Normal</span>
  </button>
`;

const timeContainer = app.querySelector('.time-container') as HTMLElement;
const clockDate = app.querySelector('.clock-date') as HTMLElement;
const btnStart = document.getElementById('btn-start') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
const btnVoice = document.getElementById('btn-voice') as HTMLButtonElement;
const btnFloat = document.getElementById('btn-float') as HTMLButtonElement;
const btnFullscreen = document.getElementById('btn-fullscreen') as HTMLButtonElement;
const toastEl = document.getElementById('toast-message') as HTMLElement;
const controls = app.querySelector('.controls') as HTMLElement;
const controlsSpacer = app.querySelector('.controls-spacer') as HTMLElement;
const modeButtons = app.querySelectorAll('.mode-switcher button');

if ('requestFullscreen' in document.documentElement) {
  btnFullscreen.style.display = 'flex';
}

const state = loadState();
let spokenRemindersEnabled = loadSpokenRemindersEnabled();
const reminderTracker = new CountdownReminderTracker();
const speechSpeaker = new SpeechSpeaker({
  onBlocked: () => {
    if (spokenRemindersEnabled) {
      showToast('Voice playback was blocked until interaction. Tap Start or Resume to enable spoken reminders.');
    }
  }
});

const timeDisplay = new TimeDisplay(timeContainer);
let countdownInput = new CountdownInput(timeContainer, state.countdown.durationMs);
const countdownClock = new CountdownClock(timeContainer);

let toastTimeout: ReturnType<typeof setTimeout> | null = null;
let toastHideTimeout: ReturnType<typeof setTimeout> | null = null;

function showToast(message: string) {
  toastEl.textContent = message;
  toastEl.style.display = 'block';
  toastEl.classList.remove('is-visible');
  void toastEl.offsetHeight;
  toastEl.classList.add('is-visible');

  if (toastTimeout !== null) clearTimeout(toastTimeout);
  if (toastHideTimeout !== null) clearTimeout(toastHideTimeout);

  toastTimeout = setTimeout(() => {
    toastEl.classList.remove('is-visible');
    toastHideTimeout = setTimeout(() => {
      toastEl.style.display = 'none';
    }, 200);
  }, 3800);
}

function getFloatingSnapshot(nowEpoch: number): FloatingTimerSnapshot {
  if (state.mode === 'stopwatch') {
    return {
      mode: 'stopwatch',
      status: state.stopwatch.status,
      displayMs: getStopwatchElapsed(
        state.stopwatch.accumulatedMs,
        state.stopwatch.startedAtEpoch,
        nowEpoch
      ),
      canStart: true
    };
  }
  if (state.mode === 'countdown') {
    const remaining =
      state.countdown.status === 'idle'
        ? state.countdown.durationMs
        : state.countdown.status === 'done'
          ? 0
          : getCountdownRemaining(
              state.countdown.durationMs,
              state.countdown.accumulatedMs,
              state.countdown.startedAtEpoch,
              nowEpoch
            );
    const progress =
      state.countdown.durationMs > 0
        ? remaining / state.countdown.durationMs
        : 0;
    return {
      mode: 'countdown',
      status: state.countdown.status,
      displayMs: remaining,
      canStart: state.countdown.durationMs > 0,
      progress
    };
  }
  return {
    mode: 'clock',
    status: 'running',
    displayMs: getLocalTimeMs(nowEpoch),
    canStart: false
  };
}

function handleFloatingOpenChange(isOpen: boolean) {
  btnFloat.classList.toggle('is-active', isOpen);
  btnFloat.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
  btnFloat.setAttribute(
    'aria-label',
    isOpen ? 'Close floating timer' : 'Open floating timer'
  );
  btnFloat.title = isOpen ? 'Close floating timer' : 'Float timer';
  syncLoops();
}

const floatingTimer = new FloatingTimer({
  getSnapshot: getFloatingSnapshot,
  onToggleStartPause: () => {
    toggleStartPause();
  },
  onCountdownComplete: () => {
    completeCountdown();
  },
  onOpenChange: handleFloatingOpenChange,
  onUnsupportedOrError: (message) => {
    showToast(message);
  },
  onTick: (snap, nowEpoch) => {
    if (snap.mode === 'countdown' && snap.status === 'running') {
      processCountdownReminders(nowEpoch);
    }
  }
});

const mobileFloatingTimer = new MobileFloatingTimer({
  getSnapshot: getFloatingSnapshot,
  onToggleStartPause: () => {
    toggleStartPause();
  },
  onCountdownComplete: () => {
    completeCountdown();
  },
  onOpenChange: handleFloatingOpenChange,
  onUnsupportedOrError: (message) => {
    showToast(message);
  }
});

function syncFloatingTimers() {
  floatingTimer.sync();
  mobileFloatingTimer.sync();
}

function toggleFloatingTimer() {
  if (isDocumentPiPSupported()) {
    void floatingTimer.toggle();
    return;
  }
  if (isVideoPiPSupported()) {
    if (state.mode === 'countdown') {
      void requestCountdownNotificationPermission();
    }
    void mobileFloatingTimer.toggle();
    return;
  }
  if (state.mode === 'countdown') {
    void requestCountdownNotificationPermission();
  }
  showToast(
    "Floating timer isn't supported in this browser. Open in Chrome for desktop or Android for Picture-in-Picture."
  );
}

countdownInput.onDurationChange = (ms) => {
  state.countdown.durationMs = ms;
  reminderTracker.reset(ms);
  saveState(state);
  syncFloatingTimers();
};

const MODES: TempoMode[] = ['stopwatch', 'countdown', 'clock'];

function setMode(newMode: TempoMode) {
  if (state.mode === newMode) return;
  if (state.mode === 'countdown' && newMode !== 'countdown') {
    speechSpeaker.cancel();
  }
  state.mode = newMode;
  saveState(state);
  renderUI();
  updateTimeDisplay();
  syncLoops();
  syncFloatingTimers();
}

modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    setMode(btn.getAttribute('data-mode') as TempoMode);
  });
});

let wakeLock: any = null;

async function updateWakeLock() {
  const needsLock = (state.mode === 'stopwatch' && state.stopwatch.status === 'running') || 
                    (state.mode === 'countdown' && state.countdown.status === 'running');
  
  if (needsLock && !wakeLock && 'wakeLock' in navigator) {
    try {
      wakeLock = await (navigator as any).wakeLock.request('screen');
      wakeLock?.addEventListener?.('release', () => {
        wakeLock = null;
      });
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
    }
  } else if (!needsLock && wakeLock) {
    try {
      await wakeLock.release();
    } catch (e) {}
    wakeLock = null;
  }
}

function updateVoiceToggleUI() {
  const active = spokenRemindersEnabled && isSpeechSupported();
  btnVoice.classList.toggle('is-enabled', active);
  btnVoice.setAttribute('aria-pressed', active ? 'true' : 'false');
  btnVoice.setAttribute(
    'aria-label',
    active ? 'Spoken countdown reminders on' : 'Spoken countdown reminders off'
  );
  btnVoice.title = active ? 'Spoken reminders: On' : 'Spoken reminders: Off';
  btnVoice.innerHTML = active ? VOICE_ON_ICON : VOICE_OFF_ICON;
}

function renderUI() {
  updateWakeLock();
  updateVoiceToggleUI();
  // Update Segmented Control
  modeButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-mode') === state.mode));
  timeDisplay.setDisplayMode(state.mode);
  
  timeContainer.style.cursor = state.mode === 'clock' ? 'default' : 'pointer';

  if (state.mode === 'stopwatch') {
    controls.style.visibility = 'visible';
    btnVoice.style.display = 'none';
    clockDate.style.display = 'none';
    timeDisplay.el.style.display = 'flex';
    timeDisplay.el.classList.remove('pulse');
    countdownInput.hide();
    countdownClock.hide();
    
    if (state.stopwatch.status === 'running') {
      btnStart.textContent = 'Pause'; btnStart.className = 'secondary'; btnReset.style.display = 'none'; controlsSpacer.style.display = 'inline-flex';
    } else if (state.stopwatch.status === 'paused') {
      btnStart.textContent = 'Resume'; btnStart.className = 'primary'; btnReset.style.display = 'inline-flex'; controlsSpacer.style.display = 'none';
    } else { // idle
      btnStart.textContent = 'Start'; btnStart.className = 'primary'; btnReset.style.display = 'none'; controlsSpacer.style.display = 'inline-flex';
    }
  } else if (state.mode === 'countdown') {
    controls.style.visibility = 'visible';
    btnVoice.style.display = 'inline-flex';
    controlsSpacer.style.display = 'none';
    clockDate.style.display = 'none';
    if (state.countdown.status === 'idle') {
      timeDisplay.el.style.display = 'none';
      countdownClock.hide();
      countdownInput.show();
      btnStart.textContent = 'Start'; btnStart.className = 'primary'; btnReset.style.display = 'none';
      timeDisplay.el.classList.remove('pulse');
    } else if (state.countdown.status === 'running') {
      timeDisplay.el.style.display = 'none';
      countdownInput.hide();
      countdownClock.show();
      btnStart.textContent = 'Pause Countdown'; btnStart.className = 'secondary'; btnReset.style.display = 'none';
      timeDisplay.el.classList.remove('pulse');
    } else if (state.countdown.status === 'paused') {
      timeDisplay.el.style.display = 'none';
      countdownInput.hide();
      countdownClock.show();
      btnStart.textContent = 'Resume Countdown'; btnStart.className = 'primary'; btnReset.style.display = 'inline-flex';
      timeDisplay.el.classList.remove('pulse');
    } else if (state.countdown.status === 'done') {
      timeDisplay.el.style.display = 'none';
      countdownInput.hide();
      countdownClock.show();
      btnStart.textContent = 'Dismiss'; btnStart.className = 'primary'; btnReset.style.display = 'none';
      timeDisplay.el.classList.add('pulse'); // We'll handle pulsing inside countdownClock for done state
      countdownClock.setPulse(true);
    }
  } else if (state.mode === 'clock') {
    controls.style.visibility = 'hidden';
    btnVoice.style.display = 'none';
    clockDate.style.display = 'block';
    timeDisplay.el.style.display = 'flex';
    countdownInput.hide();
    countdownClock.hide();
    timeDisplay.el.classList.remove('pulse');
  }
}

function getLocalTimeMs(now: number) {
  const d = new Date(now);
  return (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) * 1000 + d.getMilliseconds();
}

function setDocumentTitle(nextTitle: string) {
  if (document.title !== nextTitle) {
    document.title = nextTitle;
  }
}

function isTimerRunning(): boolean {
  return (state.mode === 'stopwatch' && state.stopwatch.status === 'running') ||
         (state.mode === 'countdown' && state.countdown.status === 'running');
}

function getBackgroundTickIntervalMs(): number {
  if (
    mobileFloatingTimer.isOpen() &&
    state.mode === 'stopwatch' &&
    state.stopwatch.status === 'running'
  ) {
    return 16;
  }
  if (
    spokenRemindersEnabled &&
    state.mode === 'countdown' &&
    state.countdown.status === 'running'
  ) {
    const remaining = getCountdownRemaining(
      state.countdown.durationMs,
      state.countdown.accumulatedMs,
      state.countdown.startedAtEpoch,
      Date.now()
    );
    if (remaining <= 13_000) {
      return 100;
    }
  }
  return 200;
}

function processCountdownReminders(nowEpoch: number) {
  if (state.mode !== 'countdown' || state.countdown.status !== 'running') {
    return;
  }
  const remaining = getCountdownRemaining(
    state.countdown.durationMs,
    state.countdown.accumulatedMs,
    state.countdown.startedAtEpoch,
    nowEpoch
  );
  const cue = reminderTracker.evaluate(
    state.countdown.durationMs,
    remaining,
    true
  );
  if (cue && spokenRemindersEnabled) {
    speechSpeaker.speak(cue.text, { urgent: cue.urgent });
  }
}

function syncLoops() {
  const isVisible = document.visibilityState === 'visible';
  const runningTimer = isTimerRunning();
  const needsBackgroundMobileClock =
    !isVisible && state.mode === 'clock' && mobileFloatingTimer.isOpen();

  if (isVisible && (state.mode === 'clock' || runningTimer)) {
    startLoop();
  } else {
    stopLoop();
  }

  if ((!isVisible && runningTimer) || needsBackgroundMobileClock) {
    startBackgroundTicker(getBackgroundTickIntervalMs());
  } else {
    stopBackgroundTicker();
  }
}

function completeCountdown() {
  if (state.countdown.status === 'done') return;
  speechSpeaker.cancel();
  reminderTracker.reset(state.countdown.durationMs);
  state.countdown.status = 'done';
  state.countdown.startedAtEpoch = null;
  state.countdown.accumulatedMs = state.countdown.durationMs;
  saveState(state);
  setDocumentTitle('Done - Tempo');
  syncLoops();
  renderUI();
  timeDisplay.setIdle(false);
  timeDisplay.updateTime(0);
  countdownClock.update(0, state.countdown.durationMs);
  syncFloatingTimers();
  playCompletionSound();

  if (
    document.visibilityState !== 'visible' ||
    floatingTimer.isOpen() ||
    mobileFloatingTimer.isOpen()
  ) {
    void notifyCountdownDone();
  }
}

function updateTimeDisplay() {
  const now = Date.now();

  if (state.mode === 'stopwatch') {
    if (state.stopwatch.status === 'idle') {
      timeDisplay.setIdle(true); timeDisplay.updateTime(0);
    } else {
      timeDisplay.setIdle(false);
      const elapsed = getStopwatchElapsed(state.stopwatch.accumulatedMs, state.stopwatch.startedAtEpoch, now);
      timeDisplay.updateTime(elapsed);
    }
    setDocumentTitle(getTabTitle(state, now));
  } else if (state.mode === 'countdown') {
    if (state.countdown.status === 'idle') {
      setDocumentTitle(getTabTitle(state, now));
    } else if (state.countdown.status === 'done') {
      timeDisplay.setIdle(false);
      timeDisplay.updateTime(0);
      countdownClock.update(0, state.countdown.durationMs);
      setDocumentTitle(getTabTitle(state, now));
    } else {
      const remaining = getCountdownRemaining(state.countdown.durationMs, state.countdown.accumulatedMs, state.countdown.startedAtEpoch, now);
      if (remaining === 0 && state.countdown.status === 'running') {
        completeCountdown();
      } else {
        timeDisplay.setIdle(false);
        timeDisplay.updateTime(remaining);
        countdownClock.update(remaining, state.countdown.durationMs);
        setDocumentTitle(getTabTitle(state, now));
        processCountdownReminders(now);
      }
    }
  } else if (state.mode === 'clock') {
    timeDisplay.setIdle(false);
    timeDisplay.updateTime(getLocalTimeMs(now));
    
    const d = new Date(now);
    const dateStr = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (clockDate.textContent !== dateStr) {
      clockDate.textContent = dateStr;
    }
    
    setDocumentTitle(getTabTitle(state, now));
  }
}

function updateBackgroundTitle() {
  const now = Date.now();
  if (state.mode === 'countdown' && state.countdown.status === 'running') {
    const remaining = getCountdownRemaining(state.countdown.durationMs, state.countdown.accumulatedMs, state.countdown.startedAtEpoch, now);
    if (remaining === 0) {
      completeCountdown();
      return;
    }
    processCountdownReminders(now);
    startBackgroundTicker(getBackgroundTickIntervalMs());
  }
  setDocumentTitle(getTabTitle(state, now));
}

subscribeToLoop(() => {
  const isRunningSW = state.mode === 'stopwatch' && state.stopwatch.status === 'running';
  const isRunningCD = state.mode === 'countdown' && state.countdown.status === 'running';
  const isClock = state.mode === 'clock';
  
  if (isRunningSW || isRunningCD || isClock) {
    updateTimeDisplay();
  }
});

subscribeToBackgroundTick(() => {
  if (isTimerRunning()) {
    updateBackgroundTitle();
    mobileFloatingTimer.renderBackgroundFrame();
  } else if (state.mode === 'clock' && mobileFloatingTimer.isOpen()) {
    mobileFloatingTimer.renderBackgroundFrame();
  }
});

// Initialization
void registerNotificationServiceWorker();
renderUI();
updateTimeDisplay();
syncLoops();

function toggleStartPause() {
  if (state.mode === 'stopwatch') {
    if (state.stopwatch.status === 'idle' || state.stopwatch.status === 'paused') {
      state.stopwatch.status = 'running'; state.stopwatch.startedAtEpoch = Date.now();
      saveState(state); renderUI(); updateTimeDisplay(); syncLoops(); syncFloatingTimers();
    } else if (state.stopwatch.status === 'running') {
      state.stopwatch.accumulatedMs = getStopwatchElapsed(state.stopwatch.accumulatedMs, state.stopwatch.startedAtEpoch, Date.now());
      state.stopwatch.startedAtEpoch = null; state.stopwatch.status = 'paused';
      saveState(state); renderUI(); syncLoops(); updateTimeDisplay(); syncFloatingTimers();
    }
  } else if (state.mode === 'countdown') {
    if (state.countdown.status === 'idle' || state.countdown.status === 'paused') {
      if (state.countdown.durationMs === 0) return;
      const wasIdle = state.countdown.status === 'idle';
      if (wasIdle) {
        reminderTracker.reset(state.countdown.durationMs);
      }
      unlockCompletionAudio();
      if (spokenRemindersEnabled) {
        speechSpeaker.prime();
      }
      void requestCountdownNotificationPermission();
      state.countdown.status = 'running'; state.countdown.startedAtEpoch = Date.now();
      saveState(state); renderUI(); updateTimeDisplay(); syncLoops(); syncFloatingTimers();
    } else if (state.countdown.status === 'running') {
      speechSpeaker.cancel();
      state.countdown.accumulatedMs = state.countdown.durationMs - getCountdownRemaining(state.countdown.durationMs, state.countdown.accumulatedMs, state.countdown.startedAtEpoch, Date.now());
      state.countdown.startedAtEpoch = null; state.countdown.status = 'paused';
      saveState(state); renderUI(); syncLoops(); updateTimeDisplay(); syncFloatingTimers();
    } else if (state.countdown.status === 'done') {
      resetTimer();
    }
  }
}

function resetTimer() {
  if (state.mode === 'stopwatch') {
    state.stopwatch.status = 'idle'; state.stopwatch.accumulatedMs = 0; state.stopwatch.startedAtEpoch = null;
    saveState(state); renderUI(); timeDisplay.resetInstant(); syncLoops(); setDocumentTitle(getTabTitle(state, Date.now())); syncFloatingTimers();
  } else if (state.mode === 'countdown') {
    speechSpeaker.cancel();
    state.countdown.status = 'idle'; state.countdown.accumulatedMs = 0; state.countdown.startedAtEpoch = null;
    reminderTracker.reset(state.countdown.durationMs);
    saveState(state); renderUI(); timeDisplay.resetInstant(); syncLoops(); setDocumentTitle(getTabTitle(state, Date.now())); syncFloatingTimers();
  }
}

btnStart.addEventListener('click', toggleStartPause);

btnReset.addEventListener('click', resetTimer);

btnVoice.addEventListener('click', () => {
  if (!isSpeechSupported()) {
    showToast("Spoken reminders aren't supported in this browser.");
    return;
  }
  spokenRemindersEnabled = !spokenRemindersEnabled;
  saveSpokenRemindersEnabled(spokenRemindersEnabled);
  if (spokenRemindersEnabled) {
    speechSpeaker.prime();
    showToast('Spoken reminders on');
  } else {
    speechSpeaker.cancel();
    showToast('Spoken reminders off');
  }
  updateVoiceToggleUI();
  syncLoops();
});

btnFloat.addEventListener('click', () => {
  toggleFloatingTimer();
});

timeContainer.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).classList.contains('toggle-input-style')) return;
  if (state.mode === 'countdown' && state.countdown.status === 'idle') return;
  if (state.mode === 'clock') return;
  btnStart.click();
});

// Gestures (Swipe)
let touchStartX = 0;
let touchStartY = 0;
document.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

document.addEventListener('touchend', (e) => {
  // Ignore inside picker
  if ((e.target as Element).closest('.picker-column')) return;
  
  const touchEndX = e.changedTouches[0].screenX;
  const touchEndY = e.changedTouches[0].screenY;
  const dx = touchEndX - touchStartX;
  const dy = Math.abs(touchEndY - touchStartY);
  
  if (Math.abs(dx) > 50 && Math.abs(dx) > dy * 2) {
    const currentIndex = MODES.indexOf(state.mode);
    if (dx < 0 && currentIndex < MODES.length - 1) {
      setMode(MODES[currentIndex + 1]); // swipe left -> next mode
    } else if (dx > 0 && currentIndex > 0) {
      setMode(MODES[currentIndex - 1]); // swipe right -> prev mode
    }
  }
});

document.addEventListener('keydown', (e) => {
  const isCountdownOperating = state.mode === 'countdown' && state.countdown.status !== 'idle';
  const isStopwatch = state.mode === 'stopwatch';
  const allowShortcuts = isCountdownOperating || isStopwatch;

  if (e.key === 'Escape') {
    if (document.fullscreenElement) {
      // Let browser exit fullscreen natively, don't reset
      return;
    }
    e.preventDefault();
    btnReset.click();
  } else if (e.key === ' ' || e.code === 'Space') {
    if (document.activeElement?.tagName === 'BUTTON') {
      const btn = document.activeElement as HTMLElement;
      const isCurrentTab = btn.getAttribute('data-mode') === state.mode;
      if (!isCurrentTab && btn !== btnStart) {
        return; // Allow native interaction with other buttons
      }
    }
    
    // Perform spacebar action (Start/Pause/Resume)
    if (allowShortcuts) {
      e.preventDefault();
      btnStart.click();
    }
  } else if (e.key.toLowerCase() === 'r') {
    // Perform 'r' reset action
    if (allowShortcuts) {
      e.preventDefault();
      btnReset.click();
    }
  }
});

document.addEventListener('visibilitychange', () => {
  syncLoops();
  if (document.visibilityState === 'visible') {
    void updateWakeLock();
    updateTimeDisplay();
    syncFloatingTimers();
  } else {
    setDocumentTitle(getTabTitle(state, Date.now()));
    mobileFloatingTimer.sync();
    saveState(state);
  }
});

btnFullscreen.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (err) {
    console.warn('Fullscreen request failed', err);
  }
});

document.addEventListener('fullscreenchange', () => {
  const isFullscreen = !!document.fullscreenElement;
  if (isFullscreen) {
    document.body.classList.add('is-fullscreen');
    btnFullscreen.setAttribute('aria-label', 'Exit fullscreen');
    btnFullscreen.title = 'Exit fullscreen';
    btnFullscreen.querySelector('.fs-enter')!.setAttribute('style', 'display: none;');
    btnFullscreen.querySelector('.fs-exit')!.removeAttribute('style');
  } else {
    document.body.classList.remove('is-fullscreen');
    btnFullscreen.setAttribute('aria-label', 'Enter fullscreen');
    btnFullscreen.title = 'Fullscreen';
    btnFullscreen.querySelector('.fs-exit')!.setAttribute('style', 'display: none;');
    btnFullscreen.querySelector('.fs-enter')!.removeAttribute('style');
  }
});
