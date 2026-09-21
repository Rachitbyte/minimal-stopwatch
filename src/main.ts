import './style.css';
import { loadState, saveState } from './store';
import type { TempoMode } from './store';
import { getStopwatchElapsed, getCountdownRemaining } from './engine/time';
import { startLoop, stopLoop, subscribeToLoop } from './engine/loop';
import { TimeDisplay } from './components/TimeDisplay';
import { CountdownInput } from './components/CountdownInput';
import { CountdownClock } from './components/CountdownClock';

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
    <button id="btn-reset" class="secondary" style="display: none;">Reset</button>
    <button id="btn-start" class="primary">Start</button>
  </footer>
  <button id="btn-fullscreen" aria-label="Enter fullscreen" class="fullscreen-btn" title="Fullscreen" style="display: none;">
    <span class="fs-enter">Full Screen</span>
    <span class="fs-exit" style="display: none;">Normal</span>
  </button>
`;

const timeContainer = app.querySelector('.time-container') as HTMLElement;
const clockDate = app.querySelector('.clock-date') as HTMLElement;
const btnStart = document.getElementById('btn-start') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
const btnFullscreen = document.getElementById('btn-fullscreen') as HTMLButtonElement;
const controls = app.querySelector('.controls') as HTMLElement;
const modeButtons = app.querySelectorAll('.mode-switcher button');

if ('requestFullscreen' in document.documentElement) {
  btnFullscreen.style.display = 'flex';
}

const state = loadState();
const timeDisplay = new TimeDisplay(timeContainer);
let countdownInput = new CountdownInput(timeContainer, state.countdown.durationMs);
const countdownClock = new CountdownClock(timeContainer);

countdownInput.onDurationChange = (ms) => {
  state.countdown.durationMs = ms;
  saveState(state);
};

const MODES: TempoMode[] = ['stopwatch', 'countdown', 'clock'];

function setMode(newMode: TempoMode) {
  if (state.mode === newMode) return;
  state.mode = newMode;
  saveState(state);
  renderUI();
  updateTimeDisplay();
  
  if (state.mode === 'clock' || 
     (state.mode === 'stopwatch' && state.stopwatch.status === 'running') ||
     (state.mode === 'countdown' && state.countdown.status === 'running')) {
    startLoop();
  } else {
    stopLoop();
  }
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

function renderUI() {
  updateWakeLock();
  // Update Segmented Control
  modeButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-mode') === state.mode));
  timeDisplay.setDisplayMode(state.mode);
  
  timeContainer.style.cursor = state.mode === 'clock' ? 'default' : 'pointer';

  if (state.mode === 'stopwatch') {
    controls.style.visibility = 'visible';
    clockDate.style.display = 'none';
    timeDisplay.el.style.display = 'flex';
    timeDisplay.el.classList.remove('pulse');
    countdownInput.hide();
    countdownClock.hide();
    
    if (state.stopwatch.status === 'running') {
      btnStart.textContent = 'Pause'; btnStart.className = 'secondary'; btnReset.style.display = 'none';
    } else if (state.stopwatch.status === 'paused') {
      btnStart.textContent = 'Resume'; btnStart.className = 'primary'; btnReset.style.display = 'inline-flex';
    } else { // idle
      btnStart.textContent = 'Start'; btnStart.className = 'primary'; btnReset.style.display = 'none';
    }
  } else if (state.mode === 'countdown') {
    controls.style.visibility = 'visible';
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

function formatTitle(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  let str = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  if (h > 0) str = `${h.toString().padStart(2, '0')}:` + str;
  return `${str} - Tempo`;
}

function updateTimeDisplay() {
  if (state.mode === 'stopwatch') {
    if (state.stopwatch.status === 'idle') {
      timeDisplay.setIdle(true); timeDisplay.updateTime(0);
      document.title = 'Tempo';
    } else {
      timeDisplay.setIdle(false);
      const elapsed = getStopwatchElapsed(state.stopwatch.accumulatedMs, state.stopwatch.startedAtEpoch, Date.now());
      timeDisplay.updateTime(elapsed);
      if (state.stopwatch.status === 'running') {
        document.title = formatTitle(elapsed);
      } else if (state.stopwatch.status === 'paused') {
        document.title = `Paused - ${formatTitle(elapsed)}`;
      } else {
        document.title = 'Tempo';
      }
    }
  } else if (state.mode === 'countdown') {
    if (state.countdown.status === 'idle') {
      // hidden
    } else if (state.countdown.status === 'done') {
      timeDisplay.setIdle(false);
      timeDisplay.updateTime(0);
      countdownClock.update(0, state.countdown.durationMs);
      document.title = 'Done - Tempo';
    } else {
      timeDisplay.setIdle(false);
      const remaining = getCountdownRemaining(state.countdown.durationMs, state.countdown.accumulatedMs, state.countdown.startedAtEpoch, Date.now());
      timeDisplay.updateTime(remaining);
      countdownClock.update(remaining, state.countdown.durationMs);
      if (state.countdown.status === 'running') {
        document.title = formatTitle(remaining);
      } else if (state.countdown.status === 'paused') {
        document.title = `Paused - ${formatTitle(remaining)}`;
      } else {
        document.title = 'Tempo';
      }
      
      if (remaining === 0 && state.countdown.status === 'running') {
        state.countdown.status = 'done';
        state.countdown.startedAtEpoch = null;
        state.countdown.accumulatedMs = state.countdown.durationMs;
        saveState(state);
        stopLoop();
        renderUI();
      }
    }
  } else if (state.mode === 'clock') {
    timeDisplay.setIdle(false);
    const now = Date.now();
    timeDisplay.updateTime(getLocalTimeMs(now));
    
    const d = new Date(now);
    const dateStr = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (clockDate.textContent !== dateStr) {
      clockDate.textContent = dateStr;
    }
    
    document.title = 'Tempo';
  }
}

subscribeToLoop(() => {
  const isRunningSW = state.mode === 'stopwatch' && state.stopwatch.status === 'running';
  const isRunningCD = state.mode === 'countdown' && state.countdown.status === 'running';
  const isClock = state.mode === 'clock';
  
  if (isRunningSW || isRunningCD || isClock) {
    updateTimeDisplay();
  }
});

// Initialization
renderUI();
updateTimeDisplay();
if (state.mode === 'clock' || 
   (state.mode === 'stopwatch' && state.stopwatch.status === 'running') || 
   (state.mode === 'countdown' && state.countdown.status === 'running')) {
  startLoop();
}

btnStart.addEventListener('click', () => {
  if (state.mode === 'stopwatch') {
    if (state.stopwatch.status === 'idle' || state.stopwatch.status === 'paused') {
      state.stopwatch.status = 'running'; state.stopwatch.startedAtEpoch = Date.now();
      saveState(state); renderUI(); startLoop();
    } else if (state.stopwatch.status === 'running') {
      state.stopwatch.accumulatedMs = getStopwatchElapsed(state.stopwatch.accumulatedMs, state.stopwatch.startedAtEpoch, Date.now());
      state.stopwatch.startedAtEpoch = null; state.stopwatch.status = 'paused';
      saveState(state); renderUI(); stopLoop(); updateTimeDisplay();
    }
  } else if (state.mode === 'countdown') {
    if (state.countdown.status === 'idle' || state.countdown.status === 'paused') {
      if (state.countdown.durationMs === 0) return;
      state.countdown.status = 'running'; state.countdown.startedAtEpoch = Date.now();
      saveState(state); renderUI(); startLoop();
    } else if (state.countdown.status === 'running') {
      state.countdown.accumulatedMs = state.countdown.durationMs - getCountdownRemaining(state.countdown.durationMs, state.countdown.accumulatedMs, state.countdown.startedAtEpoch, Date.now());
      state.countdown.startedAtEpoch = null; state.countdown.status = 'paused';
      saveState(state); renderUI(); stopLoop(); updateTimeDisplay();
    } else if (state.countdown.status === 'done') {
      btnReset.click();
    }
  }
});

btnReset.addEventListener('click', () => {
  if (state.mode === 'stopwatch') {
    state.stopwatch.status = 'idle'; state.stopwatch.accumulatedMs = 0; state.stopwatch.startedAtEpoch = null;
    saveState(state); renderUI(); timeDisplay.resetInstant();
  } else if (state.mode === 'countdown') {
    state.countdown.status = 'idle'; state.countdown.accumulatedMs = 0; state.countdown.startedAtEpoch = null;
    saveState(state); renderUI(); timeDisplay.resetInstant();
  }
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
  const needsLoop = state.mode === 'clock' || 
                    (state.mode === 'stopwatch' && state.stopwatch.status === 'running') || 
                    (state.mode === 'countdown' && state.countdown.status === 'running');
  if (document.visibilityState === 'visible') {
    if (needsLoop) { updateTimeDisplay(); startLoop(); }
  } else {
    if (state.mode !== 'clock') stopLoop();
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
