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

const STORE_KEY = 'tempo:v1';

export function loadState(): TempoState {
  try {
    const data = localStorage.getItem(STORE_KEY);
    if (!data) return JSON.parse(JSON.stringify(DEFAULT_STATE));
    const parsed = JSON.parse(data) as TempoState;
    if (parsed.version !== 1) return JSON.parse(JSON.stringify(DEFAULT_STATE));
    
    // Offline completion detection
    if (parsed.mode === 'countdown' && parsed.countdown.status === 'running' && parsed.countdown.startedAtEpoch !== null) {
      const elapsed = parsed.countdown.accumulatedMs + (Date.now() - parsed.countdown.startedAtEpoch);
      const remaining = Math.max(0, parsed.countdown.durationMs - elapsed);
      if (remaining === 0) {
        parsed.countdown.status = 'done';
        parsed.countdown.accumulatedMs = parsed.countdown.durationMs;
        parsed.countdown.startedAtEpoch = null;
        // In reality, this state mutation needs to be saved back, but doing it on load is fine for now
      }
    }
    
    return parsed;
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

export function saveState(state: TempoState): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state', e);
  }
}
