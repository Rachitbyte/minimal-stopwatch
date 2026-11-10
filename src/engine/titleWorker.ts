const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<{ type: 'start' | 'stop'; intervalMs?: number }>) => void) | null;
  postMessage: (message: unknown) => void;
};

let timerId: ReturnType<typeof setInterval> | null = null;

workerScope.onmessage = (event) => {
  const { type, intervalMs } = event.data;
  if (type === 'start') {
    if (timerId !== null) {
      clearInterval(timerId);
    }
    const interval = intervalMs ?? 200;
    timerId = setInterval(() => {
      workerScope.postMessage('tick');
    }, interval);
  } else if (type === 'stop') {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }
};

