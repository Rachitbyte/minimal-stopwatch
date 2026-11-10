import { describe, it, expect } from 'vitest';
import { formatTitleDuration, getTabTitle } from '../title';
import { DEFAULT_STATE } from '../../store';
import type { TempoState } from '../../store';

function makeState(overrides: Partial<TempoState>): TempoState {
  return {
    ...DEFAULT_STATE,
    stopwatch: { ...DEFAULT_STATE.stopwatch },
    countdown: { ...DEFAULT_STATE.countdown },
    ...overrides
  };
}

describe('Tab Title Formatting', () => {
  describe('formatTitleDuration', () => {
    it('formats sub-hour durations as MM:SS', () => {
      expect(formatTitleDuration(0)).toBe('00:00');
      expect(formatTitleDuration(5400)).toBe('00:05');
      expect(formatTitleDuration(65000)).toBe('01:05');
      expect(formatTitleDuration(3599000)).toBe('59:59');
    });

    it('formats hour+ durations as HH:MM:SS', () => {
      expect(formatTitleDuration(3600000)).toBe('01:00:00');
      expect(formatTitleDuration(3661000)).toBe('01:01:01');
    });

    it('supports ceil rounding for countdown display alignment', () => {
      expect(formatTitleDuration(10000, true)).toBe('00:10');
      expect(formatTitleDuration(9999, true)).toBe('00:10');
      expect(formatTitleDuration(9001, true)).toBe('00:10');
      expect(formatTitleDuration(9000, true)).toBe('00:09');
      expect(formatTitleDuration(1, true)).toBe('00:01');
      expect(formatTitleDuration(0, true)).toBe('00:00');
    });
  });

  describe('getTabTitle', () => {
    it('returns Tempo for idle stopwatch, idle countdown, and clock mode', () => {
      expect(getTabTitle(makeState({ mode: 'stopwatch' }), 1000)).toBe('Tempo');
      expect(getTabTitle(makeState({ mode: 'countdown' }), 1000)).toBe('Tempo');
      expect(getTabTitle(makeState({ mode: 'clock' }), 1000)).toBe('Tempo');
    });

    it('formats running and paused stopwatch titles from timestamps', () => {
      const running = makeState({
        mode: 'stopwatch',
        stopwatch: { status: 'running', accumulatedMs: 2000, startedAtEpoch: 10000 }
      });
      expect(getTabTitle(running, 13500)).toBe('00:05 - Tempo');

      const paused = makeState({
        mode: 'stopwatch',
        stopwatch: { status: 'paused', accumulatedMs: 65000, startedAtEpoch: null }
      });
      expect(getTabTitle(paused, 20000)).toBe('Paused - 01:05 - Tempo');
    });

    it('formats running, paused, and done countdown titles from timestamps', () => {
      const running = makeState({
        mode: 'countdown',
        countdown: { status: 'running', durationMs: 10000, accumulatedMs: 0, startedAtEpoch: 1000 }
      });
      expect(getTabTitle(running, 1001)).toBe('00:10 - Tempo');
      expect(getTabTitle(running, 2500)).toBe('00:09 - Tempo');
      expect(getTabTitle(running, 10999)).toBe('00:01 - Tempo');
      expect(getTabTitle(running, 11000)).toBe('Done - Tempo');

      const paused = makeState({
        mode: 'countdown',
        countdown: { status: 'paused', durationMs: 10000, accumulatedMs: 3500, startedAtEpoch: null }
      });
      expect(getTabTitle(paused, 50000)).toBe('Paused - 00:07 - Tempo');

      const done = makeState({
        mode: 'countdown',
        countdown: { status: 'done', durationMs: 10000, accumulatedMs: 10000, startedAtEpoch: null }
      });
      expect(getTabTitle(done, 50000)).toBe('Done - Tempo');
    });
  });
});

