# Data Schema

No backend is used. All state is strictly client-side and persisted in `localStorage` under the key `tempo:v1`.

## LocalStorage Schema (`tempo:v1`)

```typescript
type TempoState = {
  version: 1;
  mode: "stopwatch" | "countdown" | "clock";
  stopwatch: {
    status: "idle" | "running" | "paused";
    accumulatedMs: number;
    startedAtEpoch: number | null; // Date.now() when started
  };
  countdown: {
    status: "idle" | "running" | "paused" | "done";
    durationMs: number;
    accumulatedMs: number;
    startedAtEpoch: number | null;
  };
  countdownInputStyle: "picker" | "typed";
}
```

## State Transitions & Recovery
- When `status === 'running'`, visually compute time as:
  - Stopwatch: `accumulatedMs + (Date.now() - startedAtEpoch)`
  - Countdown: `max(0, durationMs - (accumulatedMs + (Date.now() - startedAtEpoch)))`
- If restoring a running countdown and the computed remaining time is `<= 0`, transition immediately to `status: 'done'` and trigger the completion pulse.
