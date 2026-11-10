export interface ReminderCue {
  seconds: number;
  text: string;
  urgent: boolean;
}

const FINAL_MINUTE_CHECKPOINTS = [1800, 900, 600, 300, 60]; // 30m, 15m, 10m, 5m, 1m
const MAJOR_LATENESS_TOLERANCE_MS = 3000;
const URGENT_LATENESS_TOLERANCE_MS = 900;

export function generateReminderCheckpoints(durationMs: number): number[] {
  const totalSec = Math.round(Math.max(0, durationMs) / 1000);
  if (totalSec <= 1) return [];

  const checkpoints = new Set<number>();

  if (totalSec < 5 * 60) {
    // Under 5 minutes: 1 minute and 30 seconds remaining
    checkpoints.add(60);
    checkpoints.add(30);
  } else if (totalSec < 30 * 60) {
    // 5–30 minutes: 5 minutes, 2 minutes, and 1 minute remaining
    checkpoints.add(300);
    checkpoints.add(120);
    checkpoints.add(60);
  } else if (totalSec < 60 * 60) {
    // 30–60 minutes: 30, 15, 10, 5, and 1 minute remaining
    for (const sec of FINAL_MINUTE_CHECKPOINTS) {
      checkpoints.add(sec);
    }
  } else if (totalSec < 3 * 3600) {
    // 1–3 hours: every 30 minutes, followed by 15, 10, 5, and 1 minute remaining
    for (let sec = 1800; sec < totalSec; sec += 1800) {
      checkpoints.add(sec);
    }
    for (const sec of [900, 600, 300, 60]) {
      checkpoints.add(sec);
    }
  } else if (totalSec <= 12 * 3600) {
    // 3–12 hours: every hour, followed by 30, 15, 10, 5, and 1 minute remaining
    for (let sec = 3600; sec < totalSec; sec += 3600) {
      checkpoints.add(sec);
    }
    for (const sec of FINAL_MINUTE_CHECKPOINTS) {
      checkpoints.add(sec);
    }
  } else {
    // Above 12 hours: every 2 hours initially, every hour below 3 hours, then final minute checkpoints
    for (let sec = 4 * 3600; sec < totalSec; sec += 2 * 3600) {
      checkpoints.add(sec);
    }
    checkpoints.add(2 * 3600);
    checkpoints.add(3600);
    for (const sec of FINAL_MINUTE_CHECKPOINTS) {
      checkpoints.add(sec);
    }
  }

  // Final 10-second countdown: "10 seconds left", then "9", "8", ..., "1"
  for (let sec = 10; sec >= 1; sec--) {
    checkpoints.add(sec);
  }

  return Array.from(checkpoints)
    .filter((sec) => sec > 0 && sec < totalSec)
    .sort((a, b) => b - a);
}

export function formatSpokenReminder(seconds: number): string {
  const sec = Math.max(1, Math.floor(seconds));

  if (sec <= 9) {
    return `${sec}`;
  }

  if (sec === 10 || sec === 30) {
    return `${sec} seconds left`;
  }

  if (sec < 60) {
    return `${sec} ${sec === 1 ? 'second' : 'seconds'} left`;
  }

  if (sec >= 3600) {
    const hours = Math.floor(sec / 3600);
    const remMinutes = Math.floor((sec % 3600) / 60);
    const hourPart = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    if (remMinutes === 0) {
      return `${hourPart} left`;
    }
    const minPart = `${remMinutes} ${remMinutes === 1 ? 'minute' : 'minutes'}`;
    return `${hourPart} ${minPart} left`;
  }

  const minutes = Math.floor(sec / 60);
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} left`;
}

export class CountdownReminderTracker {
  private checkpoints: number[] = [];
  private announced = new Set<number>();
  private configuredDurationMs = -1;

  public reset(durationMs: number): void {
    this.configuredDurationMs = durationMs;
    this.checkpoints = generateReminderCheckpoints(durationMs);
    this.announced.clear();
  }

  public getCheckpoints(): readonly number[] {
    return this.checkpoints;
  }

  public evaluate(
    durationMs: number,
    remainingMs: number,
    isRunning: boolean
  ): ReminderCue | null {
    if (!isRunning || remainingMs <= 0) {
      return null;
    }

    if (this.configuredDurationMs !== durationMs) {
      this.reset(durationMs);
    }

    const crossed: number[] = [];
    for (const sec of this.checkpoints) {
      if (!this.announced.has(sec) && remainingMs <= sec * 1000) {
        crossed.push(sec);
      }
    }

    if (crossed.length === 0) {
      return null;
    }

    // Consume every crossed checkpoint so skipped/throttled moments never backlog or replay
    for (const sec of crossed) {
      this.announced.add(sec);
    }

    // Checkpoints are sorted descending, so the last crossed item is the closest to remainingMs
    const latestSec = crossed[crossed.length - 1];
    const latenessMs = latestSec * 1000 - remainingMs;
    const toleranceMs =
      latestSec <= 10 ? URGENT_LATENESS_TOLERANCE_MS : MAJOR_LATENESS_TOLERANCE_MS;

    if (latenessMs > toleranceMs) {
      return null;
    }

    return {
      seconds: latestSec,
      text: formatSpokenReminder(latestSec),
      urgent: latestSec <= 10
    };
  }
}
