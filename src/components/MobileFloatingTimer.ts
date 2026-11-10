import {
  formatFloatingTime,
  type FloatingTimerSnapshot
} from './FloatingTimer';

export interface MobileFloatingTimerOptions {
  getSnapshot: (nowEpoch: number) => FloatingTimerSnapshot;
  onToggleStartPause: () => void;
  onCountdownComplete: () => void;
  onOpenChange: (isOpen: boolean) => void;
  onUnsupportedOrError: (message: string) => void;
}

interface CapturableCanvasElement extends HTMLCanvasElement {
  mozCaptureStream?: (frameRequestRate?: number) => MediaStream;
}

export function isVideoPiPSupported(): boolean {
  if (
    typeof document === 'undefined' ||
    typeof HTMLVideoElement === 'undefined' ||
    typeof HTMLCanvasElement === 'undefined'
  ) {
    return false;
  }

  const docPiPEnabled = Boolean(
    (document as unknown as { pictureInPictureEnabled?: boolean })
      .pictureInPictureEnabled
  );
  const videoProto = HTMLVideoElement.prototype as unknown as {
    requestPictureInPicture?: unknown;
  };
  const canvasProto = HTMLCanvasElement.prototype as unknown as {
    captureStream?: unknown;
    mozCaptureStream?: unknown;
  };

  return (
    docPiPEnabled &&
    typeof videoProto.requestPictureInPicture === 'function' &&
    (typeof canvasProto.captureStream === 'function' ||
      typeof canvasProto.mozCaptureStream === 'function')
  );
}

const CANVAS_WIDTH = 520;
const CANVAS_HEIGHT = 448;
const CAPTURE_FPS = 60;

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export class MobileFloatingTimer {
  private options: MobileFloatingTimerOptions;
  private canvas: CapturableCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private pipOpen = false;
  private isOpening = false;
  private isClosing = false;
  private suppressVideoEvents = false;
  private pauseCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private pauseSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private rafId: number | null = null;
  private lastFrameKey = '';
  private lastMediaMetaKey = '';
  private lastPlaybackState: 'none' | 'paused' | 'playing' = 'none';

  constructor(options: MobileFloatingTimerOptions) {
    this.options = options;
  }

  public isOpen(): boolean {
    if (!this.pipOpen || !this.video) return false;
    const activePipEl = (
      document as unknown as { pictureInPictureElement?: Element | null }
    ).pictureInPictureElement;
    return activePipEl === this.video;
  }

  public async toggle(): Promise<void> {
    if (this.isOpen()) {
      await this.close();
      return;
    }
    await this.open();
  }

  public async open(): Promise<void> {
    if (this.isOpen() || this.isOpening) return;

    if (!isVideoPiPSupported()) {
      this.options.onUnsupportedOrError(
        "Floating timer isn't supported in this browser. Open in Chrome for Android or allow Countdown notifications."
      );
      return;
    }

    this.isOpening = true;
    this.isClosing = false;

    try {
      this.createElements();
      if (!this.canvas || !this.video) {
        throw new Error('Could not initialize video stream elements.');
      }

      const docFonts = (
        document as unknown as {
          fonts?: { load?: (font: string) => Promise<unknown> };
        }
      ).fonts;
      if (docFonts && typeof docFonts.load === 'function') {
        void Promise.allSettled([
          docFonts.load('400 78px "Geist Mono"'),
          docFonts.load('400 22px "Geist Sans"')
        ]).then(() => {
          if (this.isOpen()) {
            this.lastFrameKey = '';
            this.sync();
          }
        });
      }

      const initialSnap = this.drawFrame(Date.now());

      const stream =
        typeof this.canvas.captureStream === 'function'
          ? this.canvas.captureStream(CAPTURE_FPS)
          : this.canvas.mozCaptureStream?.(CAPTURE_FPS);

      if (!stream) {
        throw new Error('Canvas stream capture is unavailable.');
      }

      this.stream = stream;
      this.video.srcObject = stream;

      this.suppressVideoEvents = true;
      try {
        await this.video.play();
      } finally {
        this.suppressVideoEvents = false;
      }

      await this.waitForMetadata(this.video);

      if (typeof this.video.requestPictureInPicture !== 'function') {
        throw new Error('Picture-in-Picture API unavailable.');
      }

      await this.video.requestPictureInPicture();
      this.pipOpen = true;
      this.attachSessionHandlers();
      this.updateMediaSession(initialSnap);
      this.options.onOpenChange(true);
      this.sync();
    } catch (err) {
      console.warn('Mobile Picture-in-Picture failed:', err);
      this.cleanup();
      this.options.onUnsupportedOrError(
        'Could not open Picture-in-Picture. Check that Picture-in-Picture is enabled for this browser in Android settings.'
      );
    } finally {
      this.isOpening = false;
    }
  }

  public async close(): Promise<void> {
    if (!this.pipOpen && !this.video) return;
    this.isClosing = true;

    try {
      const docWithPiP = document as unknown as {
        pictureInPictureElement?: Element | null;
        exitPictureInPicture?: () => Promise<void>;
      };
      if (
        docWithPiP.pictureInPictureElement &&
        typeof docWithPiP.exitPictureInPicture === 'function'
      ) {
        await docWithPiP.exitPictureInPicture();
      }
    } catch {
      // Ignore exit errors
    } finally {
      this.handleClosed();
    }
  }

  public sync(): void {
    if (!this.isOpen()) return;
    const snap = this.drawFrame(Date.now());
    this.updateMediaSession(snap);
    this.syncVideoPlayback(snap);

    const needsLoop =
      document.visibilityState === 'visible' &&
      (snap.mode === 'clock' || snap.status === 'running');
    if (needsLoop) {
      this.startLoop();
    } else {
      this.stopLoop();
    }
  }

  public renderBackgroundFrame(): void {
    if (!this.isOpen()) return;
    const snap = this.drawFrame(Date.now());
    if (snap.mode === 'countdown' && snap.status === 'running' && snap.displayMs === 0) {
      this.options.onCountdownComplete();
      return;
    }
    this.updateMediaSession(snap);
  }

  private createElements(): void {
    this.cleanupElementsOnly();

    const canvas = document.createElement('canvas') as CapturableCanvasElement;
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'fixed',
      bottom: '0',
      right: '0',
      width: '1px',
      height: '1px',
      opacity: '0.001',
      pointerEvents: 'none',
      zIndex: '-1'
    });

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas context unavailable.');
    }

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.width = CANVAS_WIDTH;
    video.height = CANVAS_HEIGHT;
    video.setAttribute('aria-hidden', 'true');
    Object.assign(video.style, {
      position: 'fixed',
      bottom: '0',
      right: '0',
      width: '1px',
      height: '1px',
      opacity: '0.001',
      pointerEvents: 'none',
      zIndex: '-1'
    });

    video.addEventListener('leavepictureinpicture', () => {
      this.handleClosed();
    });

    video.addEventListener('pause', () => {
      if (this.suppressVideoEvents || this.isClosing) return;
      if (this.pauseCheckTimer !== null) clearTimeout(this.pauseCheckTimer);
      // Delay briefly so closing PiP (which fires pause before leavepictureinpicture) never pauses the timer
      this.pauseCheckTimer = setTimeout(() => {
        this.pauseCheckTimer = null;
        if (!this.isOpen() || this.isClosing) return;
        const snap = this.options.getSnapshot(Date.now());
        if (snap.status === 'running') {
          this.options.onToggleStartPause();
        }
      }, 140);
    });

    video.addEventListener('play', () => {
      if (this.suppressVideoEvents || this.isClosing || !this.isOpen()) return;
      const snap = this.options.getSnapshot(Date.now());
      if (snap.status !== 'running' && snap.canStart && snap.mode !== 'clock') {
        this.options.onToggleStartPause();
      }
    });

    document.body.appendChild(canvas);
    document.body.appendChild(video);

    this.canvas = canvas;
    this.ctx = ctx;
    this.video = video;
  }

  private waitForMetadata(video: HTMLVideoElement): Promise<void> {
    if (video.readyState >= 1) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        video.removeEventListener('loadedmetadata', finish);
        resolve();
      };
      const timeoutId = setTimeout(finish, 1200);
      video.addEventListener('loadedmetadata', finish, { once: true });
    });
  }

  private attachSessionHandlers(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('play', () => {
        if (!this.isOpen()) return;
        const snap = this.options.getSnapshot(Date.now());
        if (snap.status !== 'running' && snap.canStart && snap.mode !== 'clock') {
          this.options.onToggleStartPause();
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (!this.isOpen()) return;
        const snap = this.options.getSnapshot(Date.now());
        if (snap.status === 'running') {
          this.options.onToggleStartPause();
        }
      });
    } catch {
      // Ignore browsers that reject mediaSession action handlers
    }
  }

  private detachSessionHandlers(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.playbackState = 'none';
    } catch {
      // Ignore cleanup errors
    }
  }

  private updateMediaSession(snap: FloatingTimerSnapshot): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const nextPlaybackState = snap.status === 'running' ? 'playing' : 'paused';
      if (this.lastPlaybackState !== nextPlaybackState) {
        this.lastPlaybackState = nextPlaybackState;
        navigator.mediaSession.playbackState = nextPlaybackState;
      }

      const modeName =
        snap.mode === 'stopwatch'
          ? 'Stopwatch'
          : snap.mode === 'countdown'
            ? 'Countdown'
            : 'Clock';
      const metaKey = `${modeName}:${snap.status}`;
      if (this.lastMediaMetaKey !== metaKey && typeof MediaMetadata !== 'undefined') {
        this.lastMediaMetaKey = metaKey;
        const base = import.meta.env.BASE_URL || '/';
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Tempo',
          artist:
            snap.status === 'paused'
              ? `${modeName} · Paused`
              : snap.status === 'done'
                ? 'Countdown · Done'
                : modeName,
          artwork: [
            {
              src: `${base}icon.png`,
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        });
      }
    } catch {
      // Ignore MediaMetadata errors on partial implementations
    }
  }

  private syncVideoPlayback(snap: FloatingTimerSnapshot): void {
    const video = this.video;
    if (!video) return;

    if (this.pauseSyncTimer !== null) {
      clearTimeout(this.pauseSyncTimer);
      this.pauseSyncTimer = null;
    }

    const shouldPlay = snap.mode === 'clock' || snap.status === 'running';
    if (shouldPlay) {
      if (video.paused) {
        this.suppressVideoEvents = true;
        void video
          .play()
          .catch(() => {})
          .finally(() => {
            this.suppressVideoEvents = false;
          });
      }
    } else {
      // Brief delay lets captureStream transmit the updated PAUSED/DONE frame before pausing video
      const ensureCapturedAndPause = async () => {
        if (video.paused) {
          this.suppressVideoEvents = true;
          try {
            await video.play();
          } catch {
            // ignore
          } finally {
            this.suppressVideoEvents = false;
          }
        }
        this.pauseSyncTimer = setTimeout(() => {
          this.pauseSyncTimer = null;
          if (!this.video || !this.isOpen()) return;
          const latest = this.options.getSnapshot(Date.now());
          if (latest.status !== 'running' && latest.mode !== 'clock') {
            this.suppressVideoEvents = true;
            this.video.pause();
            setTimeout(() => {
              this.suppressVideoEvents = false;
            }, 0);
          }
        }, 120);
      };
      void ensureCapturedAndPause();
    }
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    const tick = () => {
      if (!this.isOpen() || document.visibilityState !== 'visible') {
        this.rafId = null;
        return;
      }

      const snap = this.drawFrame(Date.now());
      if (
        snap.mode === 'countdown' &&
        snap.status === 'running' &&
        snap.displayMs === 0
      ) {
        this.rafId = null;
        this.options.onCountdownComplete();
        return;
      }

      if (snap.mode === 'clock' || snap.status === 'running') {
        this.rafId = window.requestAnimationFrame(tick);
      } else {
        this.rafId = null;
      }
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private drawFrame(nowEpoch: number): FloatingTimerSnapshot {
    const snap = this.options.getSnapshot(nowEpoch);
    if (!this.ctx) return snap;

    const { main, sub } = formatFloatingTime(snap.displayMs, snap.mode);
    const progressBucket =
      typeof snap.progress === 'number' ? Math.round(snap.progress * 200) : -1;
    const frameKey = `${snap.mode}:${snap.status}:${main}:${sub}:${progressBucket}`;

    if (frameKey === this.lastFrameKey) {
      return snap;
    }
    this.lastFrameKey = frameKey;

    const ctx = this.ctx;

    // Pure black backdrop
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Compact rounded card matching Android's floating PiP aspect ratio (~1.2:1)
    const cardX = 20;
    const cardY = 20;
    const cardW = CANVAS_WIDTH - cardX * 2;
    const cardH = CANVAS_HEIGHT - cardY * 2;
    const cardR = 64;

    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
    ctx.fillStyle = '#0A0A0A';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle =
      snap.status === 'done'
        ? 'rgba(255, 255, 255, 0.55)'
        : 'rgba(255, 255, 255, 0.16)';
    ctx.stroke();

    // Status label + dot near top of card
    const modeTitle =
      snap.mode === 'stopwatch'
        ? 'STOPWATCH'
        : snap.mode === 'countdown'
          ? 'COUNTDOWN'
          : 'CLOCK';
    const statusSuffix =
      snap.status === 'paused'
        ? ' · PAUSED'
        : snap.status === 'done'
          ? " · TIME'S UP"
          : snap.status === 'idle'
            ? ' · READY'
            : '';
    const labelText = `${modeTitle}${statusSuffix}`;

    ctx.font = '400 22px "Geist Sans", "Geist", system-ui, -apple-system, sans-serif';
    const labelWidth = ctx.measureText(labelText).width;
    const dotSize = 10;
    const dotGap = 12;
    const totalLabelW = dotSize + dotGap + labelWidth;
    const labelStartX = (CANVAS_WIDTH - totalLabelW) / 2;
    const labelY = cardY + 100;

    ctx.beginPath();
    ctx.arc(labelStartX + dotSize / 2, labelY - 7, dotSize / 2, 0, Math.PI * 2);
    ctx.fillStyle =
      snap.status === 'running' || snap.status === 'done'
        ? '#FFFFFF'
        : '#525252';
    ctx.fill();

    ctx.fillStyle = '#A3A3A3';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(labelText, labelStartX + dotSize + dotGap, labelY);

    // Main time display (weight 400 matches bundled @fontsource/geist-mono)
    const baseMainSize = sub ? 68 : 78;
    const baseSubSize = 40;
    const subGap = sub ? 6 : 0;
    const maxTimeWidth = cardW - 56;

    let mainFont = `400 ${baseMainSize}px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
    let subFont = `400 ${baseSubSize}px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;

    ctx.font = mainFont;
    let mainWidth = ctx.measureText(main).width;
    let subWidth = 0;
    if (sub) {
      ctx.font = subFont;
      subWidth = ctx.measureText(sub).width;
    }

    let totalTimeW = mainWidth + subGap + subWidth;
    if (totalTimeW > maxTimeWidth && totalTimeW > 0) {
      const ratio = maxTimeWidth / totalTimeW;
      mainFont = `400 ${Math.floor(baseMainSize * ratio)}px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
      subFont = `400 ${Math.floor(baseSubSize * ratio)}px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.font = mainFont;
      mainWidth = ctx.measureText(main).width;
      if (sub) {
        ctx.font = subFont;
        subWidth = ctx.measureText(sub).width;
      }
      totalTimeW = mainWidth + subGap + subWidth;
    }

    const timeStartX = (CANVAS_WIDTH - totalTimeW) / 2;
    const timeY =
      snap.mode === 'countdown' && snap.status !== 'idle'
        ? cardY + 228
        : cardY + 242;

    ctx.font = mainFont;
    ctx.fillStyle =
      snap.status === 'paused' || snap.status === 'idle'
        ? 'rgba(255, 255, 255, 0.65)'
        : '#FFFFFF';
    ctx.fillText(main, timeStartX, timeY);

    if (sub) {
      ctx.font = subFont;
      ctx.fillStyle =
        snap.status === 'paused' || snap.status === 'idle'
          ? 'rgba(204, 204, 204, 0.65)'
          : '#CCCCCC';
      ctx.fillText(sub, timeStartX + mainWidth + subGap, timeY);
    }

    // Countdown progress bar inside bottom of card
    if (
      snap.mode === 'countdown' &&
      snap.status !== 'idle' &&
      typeof snap.progress === 'number'
    ) {
      const trackW = 280;
      const trackH = 8;
      const trackX = (CANVAS_WIDTH - trackW) / 2;
      const trackY = cardY + cardH - 84;
      const clamped = Math.max(0, Math.min(1, snap.progress));

      drawRoundedRect(ctx, trackX, trackY, trackW, trackH, 4);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fill();

      if (clamped > 0) {
        drawRoundedRect(ctx, trackX, trackY, Math.max(8, trackW * clamped), trackH, 4);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fill();
      }
    }

    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        const captureTrack = track as MediaStreamTrack & {
          requestFrame?: () => void;
        };
        if (typeof captureTrack.requestFrame === 'function') {
          try {
            captureTrack.requestFrame();
          } catch {
            // Ignore browsers whose captureStream manages frames internally
          }
        }
      }
    }

    return snap;
  }

  private handleClosed(): void {
    const wasOpen = this.pipOpen || Boolean(this.video);
    this.cleanup();
    if (wasOpen) {
      this.options.onOpenChange(false);
    }
  }

  private cleanupElementsOnly(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
      this.video.remove();
      this.video = null;
    }

    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.ctx = null;
    }
  }

  private cleanup(): void {
    this.stopLoop();
    if (this.pauseCheckTimer !== null) {
      clearTimeout(this.pauseCheckTimer);
      this.pauseCheckTimer = null;
    }
    if (this.pauseSyncTimer !== null) {
      clearTimeout(this.pauseSyncTimer);
      this.pauseSyncTimer = null;
    }
    this.pipOpen = false;
    this.isClosing = false;
    this.lastFrameKey = '';
    this.lastMediaMetaKey = '';
    this.lastPlaybackState = 'none';
    this.detachSessionHandlers();
    this.cleanupElementsOnly();
  }
}
