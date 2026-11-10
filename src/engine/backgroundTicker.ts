import TitleWorker from './titleWorker?worker';

export type BackgroundTickCallback = () => void;

let worker: Worker | null = null;
let workerFailed = false;
let fallbackIntervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let activeIntervalMs = 200;
const callbacks = new Set<BackgroundTickCallback>();

function notify() {
  for (const cb of callbacks) {
    cb();
  }
}

function ensureWorker(): Worker | null {
  if (worker) return worker;
  if (workerFailed || typeof Worker === 'undefined') return null;

  try {
    const w = new TitleWorker();
    w.onmessage = () => {
      if (isRunning) {
        notify();
      }
    };
    w.onerror = () => {
      workerFailed = true;
      if (worker === w) {
        worker.terminate();
        worker = null;
      }
      if (isRunning && fallbackIntervalId === null) {
        fallbackIntervalId = setInterval(notify, activeIntervalMs);
      }
    };
    worker = w;
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

export function startBackgroundTicker(intervalMs = 200) {
  if (isRunning) return;
  isRunning = true;
  activeIntervalMs = intervalMs;

  const w = ensureWorker();
  if (w) {
    w.postMessage({ type: 'start', intervalMs });
  } else {
    fallbackIntervalId = setInterval(notify, intervalMs);
  }
}

export function stopBackgroundTicker() {
  if (!isRunning) return;
  isRunning = false;

  if (worker) {
    worker.postMessage({ type: 'stop' });
  }
  if (fallbackIntervalId !== null) {
    clearInterval(fallbackIntervalId);
    fallbackIntervalId = null;
  }
}

export function subscribeToBackgroundTick(cb: BackgroundTickCallback) {
  callbacks.add(cb);
}

export function unsubscribeFromBackgroundTick(cb: BackgroundTickCallback) {
  callbacks.delete(cb);
}

