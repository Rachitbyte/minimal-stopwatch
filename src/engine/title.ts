import type { TempoState } from '../store';
import { getStopwatchElapsed, getCountdownRemaining } from './time';

export function formatTitleDuration(ms: number, roundUp = false): string {
  const clampedMs = Math.max(0, ms);
  const totalSec = roundUp ? Math.ceil(clampedMs / 1000) : Math.floor(clampedMs / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  let str = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  if (h > 0) {
    str = `${h.toString().padStart(2, '0')}:${str}`;
  }
  return str;
}

export function getTabTitle(state: TempoState, nowEpoch: number): string {
  if (state.mode === 'stopwatch') {
    if (state.stopwatch.status === 'idle') return 'Tempo';
    const elapsed = getStopwatchElapsed(
      state.stopwatch.accumulatedMs,
      state.stopwatch.startedAtEpoch,
      nowEpoch
    );
    const formatted = formatTitleDuration(elapsed, false);
    if (state.stopwatch.status === 'running') return `${formatted} - Tempo`;
    if (state.stopwatch.status === 'paused') return `Paused - ${formatted} - Tempo`;
    return 'Tempo';
  }

  if (state.mode === 'countdown') {
    if (state.countdown.status === 'idle') return 'Tempo';
    if (state.countdown.status === 'done') return 'Done - Tempo';

    const remaining = getCountdownRemaining(
      state.countdown.durationMs,
      state.countdown.accumulatedMs,
      state.countdown.startedAtEpoch,
      nowEpoch
    );

    if (state.countdown.status === 'running') {
      if (remaining === 0) return 'Done - Tempo';
      return `${formatTitleDuration(remaining, true)} - Tempo`;
    }

    if (state.countdown.status === 'paused') {
      return `Paused - ${formatTitleDuration(remaining, true)} - Tempo`;
    }

    return 'Tempo';
  }

  return 'Tempo';
}

