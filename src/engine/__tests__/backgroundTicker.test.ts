import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const workerPostMessage = vi.fn();
const workerTerminate = vi.fn();
let latestWorkerInstance: {
  onmessage: ((e: MessageEvent) => void) | null;
  onerror: (() => void) | null;
  postMessage: typeof workerPostMessage;
  terminate: typeof workerTerminate;
} | null = null;

vi.mock('../titleWorker?worker', () => {
  return {
    default: class MockTitleWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage = workerPostMessage;
      terminate = workerTerminate;
      constructor() {
        latestWorkerInstance = this;
      }
    }
  };
});

describe('backgroundTicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    workerPostMessage.mockClear();
    workerTerminate.mockClear();
    latestWorkerInstance = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses Web Worker when available and delivers ticks while running', async () => {
    vi.stubGlobal('Worker', class {});
    const ticker = await import('../backgroundTicker');
    const cb = vi.fn();

    ticker.subscribeToBackgroundTick(cb);
    ticker.startBackgroundTicker(200);

    expect(latestWorkerInstance).not.toBeNull();
    expect(workerPostMessage).toHaveBeenCalledWith({ type: 'start', intervalMs: 200 });

    latestWorkerInstance!.onmessage?.(new MessageEvent('message', { data: 'tick' }));
    expect(cb).toHaveBeenCalledTimes(1);

    ticker.stopBackgroundTicker();
    expect(workerPostMessage).toHaveBeenCalledWith({ type: 'stop' });

    // Stale queued worker messages after stop must be ignored
    latestWorkerInstance!.onmessage?.(new MessageEvent('message', { data: 'tick' }));
    expect(cb).toHaveBeenCalledTimes(1);

    ticker.unsubscribeFromBackgroundTick(cb);
  });

  it('falls back to setInterval if worker throws an error', async () => {
    vi.stubGlobal('Worker', class {});
    const ticker = await import('../backgroundTicker');
    const cb = vi.fn();

    ticker.subscribeToBackgroundTick(cb);
    ticker.startBackgroundTicker(250);

    expect(latestWorkerInstance).not.toBeNull();
    latestWorkerInstance!.onerror?.();
    expect(workerTerminate).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(2);

    ticker.stopBackgroundTicker();
    vi.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(2);

    ticker.unsubscribeFromBackgroundTick(cb);
  });
});

