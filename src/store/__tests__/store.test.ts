import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadState, saveState, DEFAULT_STATE } from '../index';
import type { TempoState } from '../index';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('Store Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads default state when empty', () => {
    expect(loadState()).toEqual(DEFAULT_STATE);
  });

  it('saves and loads exact state', () => {
    const customState: TempoState = {
      ...DEFAULT_STATE,
      mode: 'countdown',
      stopwatch: { status: 'paused', accumulatedMs: 5000, startedAtEpoch: null }
    };
    saveState(customState);
    expect(loadState()).toEqual(customState);
  });

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem('tempo:v1', '{ invalid json');
    expect(loadState()).toEqual(DEFAULT_STATE);
  });

  it('detects offline completion for running countdown', () => {
    vi.setSystemTime(10000);
    const state: TempoState = {
      ...DEFAULT_STATE,
      mode: 'countdown',
      countdown: {
        status: 'running',
        durationMs: 5000,
        accumulatedMs: 0,
        startedAtEpoch: 1000 // started 9000ms ago, duration is only 5000ms
      }
    };
    saveState(state);
    
    // When loaded now, the countdown should be 'done' because 9s > 5s
    const loaded = loadState();
    expect(loaded.countdown.status).toBe('done');
    expect(loaded.countdown.accumulatedMs).toBe(5000);
    expect(loaded.countdown.startedAtEpoch).toBeNull();
  });
});
