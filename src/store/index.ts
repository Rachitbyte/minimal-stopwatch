export type TempoMode = 'stopwatch' | 'countdown' | 'clock';
export type StopwatchStatus = 'idle' | 'running' | 'paused';
export type CountdownStatus = 'idle' | 'running' | 'paused' | 'done';

export type TempoState = {
  version: 1;
  mode: TempoMode;
  stopwatch: {
    status: StopwatchStatus;
    accumulatedMs: number;
    startedAtEpoch: number | null;
  };
  countdown: {
    status: CountdownStatus;
    durationMs: number;
    accumulatedMs: number;
    startedAtEpoch: number | null;
  };
  countdownInputStyle: 'picker' | 'typed';
};

export const DEFAULT_STATE: TempoState = {
  version: 1,
  mode: 'stopwatch',
  stopwatch: { status: 'idle', accumulatedMs: 0, startedAtEpoch: null },
  countdown: { status: 'idle', durationMs: 0, accumulatedMs: 0, startedAtEpoch: null },
  countdownInputStyle: 'picker'
};

export function loadState(): TempoState {
  // Always return a fresh instance of the default state
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

export function saveState(_state: TempoState): void {
  // No-op: Local storage persistence has been removed
  // State is now only kept in-memory while the tab is open
}
