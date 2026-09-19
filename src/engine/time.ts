export function getStopwatchElapsed(accumulatedMs: number, startedAtEpoch: number | null, nowEpoch: number): number {
  if (startedAtEpoch === null) return accumulatedMs;
  return accumulatedMs + (nowEpoch - startedAtEpoch);
}

export function getCountdownRemaining(durationMs: number, accumulatedMs: number, startedAtEpoch: number | null, nowEpoch: number): number {
  const elapsed = startedAtEpoch === null ? accumulatedMs : accumulatedMs + (nowEpoch - startedAtEpoch);
  return Math.max(0, durationMs - elapsed);
}
