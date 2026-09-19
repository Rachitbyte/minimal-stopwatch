export type LoopCallback = (now: number, frameDelta: number) => void;

let frameId: number | null = null;
let lastTime: number | null = null;
const callbacks: Set<LoopCallback> = new Set();

export function startLoop() {
  if (frameId !== null) return;
  lastTime = performance.now();
  
  const tick = (time: number) => {
    const delta = lastTime !== null ? time - lastTime : 0;
    lastTime = time;
    
    for (const cb of callbacks) {
      cb(time, delta);
    }
    
    frameId = requestAnimationFrame(tick);
  };
  
  frameId = requestAnimationFrame(tick);
}

export function stopLoop() {
  if (frameId !== null) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }
  lastTime = null;
}

export function subscribeToLoop(cb: LoopCallback) {
  callbacks.add(cb);
}

export function unsubscribeFromLoop(cb: LoopCallback) {
  callbacks.delete(cb);
}
