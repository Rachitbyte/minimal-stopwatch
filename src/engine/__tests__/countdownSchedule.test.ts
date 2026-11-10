import { describe, it, expect } from 'vitest';
import {
  generateReminderCheckpoints,
  formatSpokenReminder,
  CountdownReminderTracker
} from '../countdownSchedule';

describe('countdownSchedule', () => {
  it('generates expected checkpoints for a 2-minute countdown', () => {
    const cps = generateReminderCheckpoints(2 * 60 * 1000);
    expect(cps).toEqual([60, 30, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(cps.map(formatSpokenReminder)).toEqual([
      '1 minute left',
      '30 seconds left',
      '10 seconds left',
      '9',
      '8',
      '7',
      '6',
      '5',
      '4',
      '3',
      '2',
      '1'
    ]);
  });

  it('generates expected checkpoints for 5-minute and 10-minute countdowns', () => {
    expect(generateReminderCheckpoints(5 * 60 * 1000)).toEqual([
      120, 60, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
    ]);
    expect(generateReminderCheckpoints(10 * 60 * 1000)).toEqual([
      300, 120, 60, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
    ]);
  });

  it('generates expected checkpoints for 30-minute and 45-minute countdowns', () => {
    expect(generateReminderCheckpoints(30 * 60 * 1000)).toEqual([
      900, 600, 300, 60, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
    ]);
    expect(generateReminderCheckpoints(45 * 60 * 1000)).toEqual([
      1800, 900, 600, 300, 60, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
    ]);
  });

  it('generates 30-minute interval checkpoints without duplicates for 1h and 2h countdowns', () => {
    expect(generateReminderCheckpoints(3600 * 1000)).toEqual([
      1800, 900, 600, 300, 60, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
    ]);

    const twoHours = generateReminderCheckpoints(2 * 3600 * 1000);
    expect(twoHours).toEqual([
      5400, 3600, 1800, 900, 600, 300, 60, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
    ]);
    expect(formatSpokenReminder(5400)).toBe('1 hour 30 minutes left');
    expect(formatSpokenReminder(3600)).toBe('1 hour left');
  });

  it('generates hourly then minute checkpoints without duplicates for an 8-hour countdown', () => {
    const cps = generateReminderCheckpoints(8 * 3600 * 1000);
    expect(cps).toEqual([
      7 * 3600,
      6 * 3600,
      5 * 3600,
      4 * 3600,
      3 * 3600,
      2 * 3600,
      3600,
      1800,
      900,
      600,
      300,
      60,
      10,
      9,
      8,
      7,
      6,
      5,
      4,
      3,
      2,
      1
    ]);
    expect(new Set(cps).size).toBe(cps.length);
    expect(formatSpokenReminder(7 * 3600)).toBe('7 hours left');
  });

  it('generates 2-hour then hourly below 3h then final minutes for above-12-hour countdowns', () => {
    const cps = generateReminderCheckpoints(16 * 3600 * 1000);
    expect(cps).toEqual([
      14 * 3600,
      12 * 3600,
      10 * 3600,
      8 * 3600,
      6 * 3600,
      4 * 3600,
      2 * 3600,
      3600,
      1800,
      900,
      600,
      300,
      60,
      10,
      9,
      8,
      7,
      6,
      5,
      4,
      3,
      2,
      1
    ]);
  });

  it('never duplicates announcements, skips while paused, and recovers cleanly after tab sleep', () => {
    const tracker = new CountdownReminderTracker();
    const dur = 5 * 60 * 1000;
    tracker.reset(dur);

    // At 2m01s, no checkpoint crossed yet
    expect(tracker.evaluate(dur, 121_000, true)).toBeNull();

    // Crosses 2m (120_000ms) -> speaks once
    expect(tracker.evaluate(dur, 119_900, true)).toEqual({
      seconds: 120,
      text: '2 minutes left',
      urgent: false
    });
    // Next frame & after pause/resume -> never repeats 2 minutes
    expect(tracker.evaluate(dur, 119_500, true)).toBeNull();
    expect(tracker.evaluate(dur, 60_000, false)).toBeNull(); // paused: must not announce
    expect(tracker.evaluate(dur, 59_850, true)).toEqual({
      seconds: 60,
      text: '1 minute left',
      urgent: false
    });

    // Simulate long background sleep skipping directly past 10s down to 7.9s
    // Late checkpoints (> 900ms for urgent) should be marked consumed without piling up
    expect(tracker.evaluate(dur, 7_900, true)).toEqual({
      seconds: 8,
      text: '8',
      urgent: true
    });
    expect(tracker.evaluate(dur, 6_950, true)).toEqual({
      seconds: 7,
      text: '7',
      urgent: true
    });

    // Zero or negative remaining never announces
    expect(tracker.evaluate(dur, 0, true)).toBeNull();

    // Resetting for a new countdown allows checkpoints to fire again
    tracker.reset(2 * 60 * 1000);
    expect(tracker.evaluate(2 * 60 * 1000, 60_000, true)?.text).toBe('1 minute left');
  });
});
