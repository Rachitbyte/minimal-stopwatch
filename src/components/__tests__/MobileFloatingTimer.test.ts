import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MobileFloatingTimer, isVideoPiPSupported } from '../MobileFloatingTimer';
import type { FloatingTimerSnapshot } from '../FloatingTimer';

function createFake2DContext() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    measureText: vi.fn((t: string) => ({ width: t.length * 20 })),
    fillText: vi.fn()
  };
}

describe('MobileFloatingTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('detects unsupported environments and emits fallback message cleanly', async () => {
    vi.stubGlobal('document', { pictureInPictureEnabled: false });
    expect(isVideoPiPSupported()).toBe(false);

    const onUnsupportedOrError = vi.fn();
    const timer = new MobileFloatingTimer({
      getSnapshot: () => ({ mode: 'stopwatch', status: 'idle', displayMs: 0, canStart: true }),
      onToggleStartPause: vi.fn(),
      onCountdownComplete: vi.fn(),
      onOpenChange: vi.fn(),
      onUnsupportedOrError
    });

    await timer.open();
    expect(timer.isOpen()).toBe(false);
    expect(onUnsupportedOrError).toHaveBeenCalledTimes(1);
    expect(onUnsupportedOrError.mock.calls[0][0]).toMatch(/Chrome for Android/i);
  });

  it('opens video PiP from canvas stream, syncs MediaSession, and ignores close pause', async () => {
    const fakeTrack = { stop: vi.fn() };
    const fakeStream = { getTracks: () => [fakeTrack] };
    const fakeCtx = createFake2DContext();
    const videoListeners: Record<string, Array<() => void>> = {};
    const actionHandlers: Record<string, (() => void) | null> = {};

    const docState: {
      pictureInPictureEnabled: boolean;
      pictureInPictureElement: unknown;
      visibilityState: string;
      body: { appendChild: ReturnType<typeof vi.fn> };
      createElement: (tag: string) => any;
    } = {
      pictureInPictureEnabled: true,
      pictureInPictureElement: null,
      visibilityState: 'visible',
      body: { appendChild: vi.fn() },
      createElement: () => null
    };

    const fakeCanvas = {
      width: 0,
      height: 0,
      style: {} as Record<string, string>,
      setAttribute: vi.fn(),
      getContext: vi.fn(() => fakeCtx),
      captureStream: vi.fn(() => fakeStream),
      remove: vi.fn()
    };

    const fakeVideo = {
      width: 0,
      height: 0,
      muted: false,
      playsInline: false,
      autoplay: false,
      paused: true,
      readyState: 1,
      srcObject: null as unknown,
      style: {} as Record<string, string>,
      setAttribute: vi.fn(),
      remove: vi.fn(),
      addEventListener: (ev: string, cb: () => void) => {
        if (!videoListeners[ev]) videoListeners[ev] = [];
        videoListeners[ev].push(cb);
      },
      removeEventListener: vi.fn(),
      play: vi.fn(async () => {
        fakeVideo.paused = false;
      }),
      pause: vi.fn(() => {
        fakeVideo.paused = true;
      }),
      requestPictureInPicture: vi.fn(async () => {
        docState.pictureInPictureElement = fakeVideo;
      })
    };

    docState.createElement = (tag: string) =>
      tag === 'canvas' ? fakeCanvas : fakeVideo;

    class FakeCanvasCtor {
      captureStream() {}
    }
    class FakeVideoCtor {
      requestPictureInPicture() {}
    }

    vi.stubGlobal('HTMLCanvasElement', FakeCanvasCtor);
    vi.stubGlobal('HTMLVideoElement', FakeVideoCtor);
    vi.stubGlobal('document', docState);
    vi.stubGlobal('window', {
      requestAnimationFrame: vi.fn(() => 1),
      cancelAnimationFrame: vi.fn()
    });
    vi.stubGlobal('navigator', {
      mediaSession: {
        playbackState: 'none',
        metadata: null,
        setActionHandler: vi.fn((action: string, handler: (() => void) | null) => {
          actionHandlers[action] = handler;
        })
      }
    });

    expect(isVideoPiPSupported()).toBe(true);

    let snapshot: FloatingTimerSnapshot = {
      mode: 'stopwatch',
      status: 'running',
      displayMs: 5200,
      canStart: true
    };
    const onToggleStartPause = vi.fn(() => {
      snapshot = {
        ...snapshot,
        status: snapshot.status === 'running' ? 'paused' : 'running'
      };
      timer.sync();
    });
    const onOpenChange = vi.fn();

    const timer = new MobileFloatingTimer({
      getSnapshot: () => snapshot,
      onToggleStartPause,
      onCountdownComplete: vi.fn(),
      onOpenChange,
      onUnsupportedOrError: vi.fn()
    });

    await timer.open();
    expect(timer.isOpen()).toBe(true);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(fakeCanvas.captureStream).toHaveBeenCalledWith(15);
    expect(fakeVideo.requestPictureInPicture).toHaveBeenCalledTimes(1);
    expect(fakeCtx.fillText).toHaveBeenCalledWith('00:00:05', expect.any(Number), expect.any(Number));

    // Tapping Pause via MediaSession pauses the main timer
    actionHandlers['pause']?.();
    expect(onToggleStartPause).toHaveBeenCalledTimes(1);
    expect(snapshot.status).toBe('paused');

    // Resuming via MediaSession resumes the main timer
    actionHandlers['play']?.();
    expect(onToggleStartPause).toHaveBeenCalledTimes(2);
    expect(snapshot.status).toBe('running');

    // Simulate OS closing PiP window (pause fired immediately before leavepictureinpicture)
    for (const cb of videoListeners['pause'] ?? []) cb();
    docState.pictureInPictureElement = null;
    for (const cb of videoListeners['leavepictureinpicture'] ?? []) cb();
    vi.advanceTimersByTime(200);

    // Timer must STILL be running (not paused by closing PiP!)
    expect(onToggleStartPause).toHaveBeenCalledTimes(2);
    expect(snapshot.status).toBe('running');
    expect(timer.isOpen()).toBe(false);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(fakeTrack.stop).toHaveBeenCalledTimes(1);
  });

  it('uses ~1.16:1 canvas dimensions for Android PiP, loads fonts, and scales long times cleanly', async () => {
    const fakeTrack = { stop: vi.fn() };
    const fakeStream = { getTracks: () => [fakeTrack] };
    const fakeCtx = createFake2DContext();
    fakeCtx.measureText = vi.fn((t: string) => ({ width: t.length * 50 }));

    let resolveFonts!: () => void;
    const fontLoadPromise = new Promise<void>((res) => {
      resolveFonts = res;
    });
    const loadSpy = vi.fn(() => fontLoadPromise);

    const fakeCanvas = {
      width: 0,
      height: 0,
      style: {} as Record<string, string>,
      setAttribute: vi.fn(),
      getContext: vi.fn(() => fakeCtx),
      captureStream: vi.fn(() => fakeStream),
      remove: vi.fn()
    };

    const docState: any = {
      pictureInPictureEnabled: true,
      pictureInPictureElement: null,
      visibilityState: 'visible',
      fonts: { load: loadSpy },
      body: { appendChild: vi.fn() },
      createElement: (tag: string) => (tag === 'canvas' ? fakeCanvas : fakeVideo)
    };

    const fakeVideo = {
      width: 0,
      height: 0,
      muted: false,
      playsInline: false,
      autoplay: false,
      paused: true,
      readyState: 1,
      srcObject: null as unknown,
      style: {} as Record<string, string>,
      setAttribute: vi.fn(),
      remove: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      play: vi.fn(async () => {
        fakeVideo.paused = false;
      }),
      pause: vi.fn(),
      requestPictureInPicture: vi.fn(async () => {
        docState.pictureInPictureElement = fakeVideo;
      })
    };

    class FakeCanvasCtor {
      captureStream() {}
    }
    class FakeVideoCtor {
      requestPictureInPicture() {}
    }

    vi.stubGlobal('HTMLCanvasElement', FakeCanvasCtor);
    vi.stubGlobal('HTMLVideoElement', FakeVideoCtor);
    vi.stubGlobal('document', docState);
    vi.stubGlobal('window', {
      requestAnimationFrame: vi.fn(() => 1),
      cancelAnimationFrame: vi.fn()
    });

    const timer = new MobileFloatingTimer({
      getSnapshot: () => ({
        mode: 'countdown',
        status: 'running',
        displayMs: 120 * 3600 * 1000,
        canStart: true,
        progress: 0.5
      }),
      onToggleStartPause: vi.fn(),
      onCountdownComplete: vi.fn(),
      onOpenChange: vi.fn(),
      onUnsupportedOrError: vi.fn()
    });

    await timer.open();

    // Aspect ratio ~1.16:1 matches Android's floating PiP box without horizontal squishing
    expect(fakeCanvas.width).toBe(520);
    expect(fakeCanvas.height).toBe(448);
    expect(fakeCanvas.width / fakeCanvas.height).toBeCloseTo(1.16, 2);

    // Explicitly preloads Geist Mono & Geist Sans and redraws when ready
    expect(loadSpy).toHaveBeenCalledWith('400 78px "Geist Mono"');
    expect(loadSpy).toHaveBeenCalledWith('400 22px "Geist Sans"');

    const initialFillCount = fakeCtx.fillText.mock.calls.length;
    resolveFonts();
    await Promise.resolve();
    await Promise.resolve();
    expect(fakeCtx.fillText.mock.calls.length).toBeGreaterThan(initialFillCount);

    // Long hour text (120:00:00 -> width 450 > maxTimeWidth 424) gets scaled down smoothly
    expect(fakeCtx.font).toMatch(/400 \d+px "Geist Mono"/);
  });
});

