import { describe, it, expect } from 'vitest';
import { getStopwatchElapsed, getCountdownRemaining } from '../time';

describe('Timing Engine', () => {
  describe('Stopwatch', () => {
    it('returns 0 when idle', () => {
      expect(getStopwatchElapsed(0, null, 1000)).toBe(0);
    });

    it('returns exact elapsed time when running', () => {
      const start = 1000;
      const now = 2500;
      expect(getStopwatchElapsed(0, start, now)).toBe(1500);
    });

    it('adds accumulated time correctly after pause/resume', () => {
      const accumulated = 5000;
      const start = 10000;
      const now = 12000;
      expect(getStopwatchElapsed(accumulated, start, now)).toBe(7000);
    });
  });

  describe('Countdown', () => {
    it('returns duration when idle', () => {
      expect(getCountdownRemaining(10000, 0, null, 1000)).toBe(10000);
    });

    it('returns correct remaining time when running', () => {
      const duration = 10000;
      const start = 1000;
      const now = 4000; // 3000ms elapsed
      expect(getCountdownRemaining(duration, 0, start, now)).toBe(7000);
    });

    it('floors at 0 when time is up', () => {
      const duration = 10000;
      const start = 1000;
      const now = 15000; // 14000ms elapsed
      expect(getCountdownRemaining(duration, 0, start, now)).toBe(0);
    });
    
    it('handles accumulated time correctly', () => {
      const duration = 10000;
      const accumulated = 4000; // We already ran 4s before pausing
      const start = 5000;
      const now = 8000; // 3s elapsed this run (total 7s)
      expect(getCountdownRemaining(duration, accumulated, start, now)).toBe(3000);
    });
  });
});
