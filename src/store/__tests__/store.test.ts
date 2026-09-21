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

  it('does not persist state (starts fresh every time)', () => {
    const customState: TempoState = {
      ...DEFAULT_STATE,
      mode: 'countdown',
      stopwatch: { status: 'paused', accumulatedMs: 5000, startedAtEpoch: null }
    };
    saveState(customState); // This is now a no-op
    expect(loadState()).toEqual(DEFAULT_STATE); // Should load default, not customState
  });
});
