import type { TempoMode } from '../store';

export type FloatingTimerStatus = 'idle' | 'running' | 'paused' | 'done';

export interface FloatingTimerSnapshot {
  mode: TempoMode;
  status: FloatingTimerStatus;
  displayMs: number;
  canStart: boolean;
  progress?: number;
}

export interface FloatingTimerOptions {
  getSnapshot: (nowEpoch: number) => FloatingTimerSnapshot;
  onToggleStartPause: () => void;
  onCountdownComplete: () => void;
  onOpenChange: (isOpen: boolean) => void;
  onUnsupportedOrError: (message: string) => void;
}

interface DocumentPiPWindow extends Window {
  document: Document;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(handle: number): void;
  closed: boolean;
  close(): void;
}

interface DocumentPictureInPictureAPI {
  window?: DocumentPiPWindow | null;
  requestWindow(options?: { width?: number; height?: number }): Promise<DocumentPiPWindow>;
}

export function isDocumentPiPSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const api = (window as unknown as { documentPictureInPicture?: DocumentPictureInPictureAPI })
    .documentPictureInPicture;
  return Boolean(api && typeof api.requestWindow === 'function');
}

export function formatFloatingTime(
  ms: number,
  mode: TempoMode
): { main: string; sub: string } {
  const clampedMs = Math.max(0, ms);

  if (mode === 'clock') {
    const totalSec = Math.floor(clampedMs / 1000);
    const sec = totalSec % 60;
    const min = Math.floor(totalSec / 60) % 60;
    const hr24 = Math.floor(totalSec / 3600) % 24;
    const ampm = hr24 >= 12 ? 'PM' : 'AM';
    const hr12 = hr24 % 12 || 12;
    return {
      main: `${hr12.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`,
      sub: ` ${ampm}`
    };
  }

  if (mode === 'countdown') {
    const totalSec = Math.ceil(clampedMs / 1000);
    const s = totalSec % 60;
    const m = Math.floor(totalSec / 60) % 60;
    const h = Math.floor(totalSec / 3600);
    return {
      main: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`,
      sub: ''
    };
  }

  // Stopwatch: HH:MM:SS.cc
  const totalCenti = Math.floor(clampedMs / 10);
  const centi = totalCenti % 100;
  const totalSec = Math.floor(clampedMs / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  return {
    main: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`,
    sub: `.${centi.toString().padStart(2, '0')}`
  };
}

const PAUSE_ICON = `
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
    <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
  </svg>
`;

const PLAY_ICON = `
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M4.5 2.75a.75.75 0 0 1 1.14-.64l8 5.25a.75.75 0 0 1 0 1.28l-8 5.25A.75.75 0 0 1 4.5 13.25V2.75z" />
  </svg>
`;

const CHECK_ICON = `
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
`;

const CLOSE_ICON = `
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
`;

const PIP_STYLES = `
  *, *::before, *::after {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: #000000;
    color: #FFFFFF;
    font-family: "Geist", system-ui, -apple-system, sans-serif;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
    -webkit-font-smoothing: antialiased;
  }

  @keyframes islandEnter {
    from {
      opacity: 0;
      transform: scale(0.92);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes dotPulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.35;
      transform: scale(0.85);
    }
  }

  @keyframes donePulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.65;
      transform: scale(0.985);
    }
  }

  .island-stage {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(4px, 2vh, 10px) clamp(6px, 2.5vw, 12px);
    background: #000000;
  }

  .island-pill {
    position: relative;
    width: 100%;
    max-width: 440px;
    height: 100%;
    min-height: 46px;
    max-height: 68px;
    background: #0A0A0A;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: clamp(8px, 3vw, 14px);
    padding: 6px 10px 6px 16px;
    overflow: hidden;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.07);
    animation: islandEnter 220ms cubic-bezier(0.16, 1, 0.3, 1);
    transition: border-color 180ms ease, background-color 180ms ease;
  }

  .island-pill.is-done {
    border-color: rgba(255, 255, 255, 0.45);
  }

  .island-left {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2.5vw, 12px);
    min-width: 0;
  }

  .island-dot {
    width: 6px;
    height: 6px;
    border-radius: 9999px;
    background: #525252;
    flex: none;
    transition: background-color 180ms ease, opacity 180ms ease;
  }

  .island-pill.is-running .island-dot {
    background: #FFFFFF;
    animation: dotPulse 1.8s ease-in-out infinite;
  }

  .island-pill.is-done .island-dot {
    background: #FFFFFF;
    animation: dotPulse 1.1s ease-in-out infinite;
  }

  .island-time-wrap {
    display: flex;
    align-items: baseline;
    font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    white-space: nowrap;
    transition: opacity 180ms ease;
  }

  .island-pill.is-idle .island-time-wrap,
  .island-pill.is-paused .island-time-wrap {
    opacity: 0.65;
  }

  .island-pill.is-done .island-time-wrap {
    animation: donePulse 1.4s ease-in-out infinite;
  }

  .island-time {
    font-size: clamp(17px, 6.4vw, 28px);
    font-weight: 500;
    letter-spacing: -0.02em;
    color: #FFFFFF;
  }

  .island-sub {
    font-size: clamp(11px, 3.6vw, 16px);
    font-weight: 400;
    color: #A3A3A3;
  }

  .island-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
  }

  .island-btn {
    appearance: none;
    border: none;
    width: clamp(30px, 9.5vw, 36px);
    height: clamp(30px, 9.5vw, 36px);
    padding: 0;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 140ms ease, opacity 140ms ease, background-color 160ms ease, border-color 160ms ease;
  }

  .island-btn:active {
    transform: scale(0.9);
  }

  .island-btn:focus-visible {
    outline: 2px solid #FFFFFF;
    outline-offset: 2px;
  }

  .island-btn-toggle {
    background: #FFFFFF;
    color: #000000;
  }

  .island-btn-toggle:hover:not(:disabled) {
    opacity: 0.9;
  }

  .island-btn-toggle.is-secondary {
    background: #1A1A1A;
    color: #FFFFFF;
    border: 1px solid #333333;
  }

  .island-btn-toggle.is-secondary:hover:not(:disabled) {
    background: #262626;
  }

  .island-btn-toggle:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .island-btn-close {
    background: rgba(255, 255, 255, 0.08);
    color: #A3A3A3;
  }

  .island-btn-close:hover {
    background: rgba(255, 255, 255, 0.16);
    color: #FFFFFF;
  }

  .island-progress-track {
    position: absolute;
    left: 20px;
    right: 20px;
    bottom: 0;
    height: 2px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    overflow: hidden;
    pointer-events: none;
  }

  .island-progress-fill {
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.65);
    transform-origin: left center;
    transition: transform 80ms linear;
  }

  @media (prefers-reduced-motion: reduce) {
    .island-pill,
    .island-pill.is-running .island-dot,
    .island-pill.is-done .island-dot,
    .island-pill.is-done .island-time-wrap {
      animation: none;
    }
    .island-btn,
    .island-progress-fill {
      transition: none;
    }
  }
`;

export class FloatingTimer {
  private options: FloatingTimerOptions;
  private pipWindow: DocumentPiPWindow | null = null;
  private isOpening = false;
  private rafId: number | null = null;

  private pillEl: HTMLElement | null = null;
  private timeEl: HTMLElement | null = null;
  private subEl: HTMLElement | null = null;
  private toggleBtn: HTMLButtonElement | null = null;
  private progressTrackEl: HTMLElement | null = null;
  private progressFillEl: HTMLElement | null = null;

  private lastMainText = '';
  private lastSubText = '';
  private lastBtnModeKey = '';

  constructor(options: FloatingTimerOptions) {
    this.options = options;
  }

  public isOpen(): boolean {
    return Boolean(this.pipWindow && !this.pipWindow.closed);
  }

  public async toggle(): Promise<void> {
    if (this.isOpen()) {
      this.close();
      return;
    }
    await this.open();
  }

  public async open(): Promise<void> {
    if (this.isOpen() || this.isOpening) return;

    if (!isDocumentPiPSupported()) {
      this.options.onUnsupportedOrError(
        'Floating timer requires Chrome or Microsoft Edge on desktop.'
      );
      return;
    }

    const api = (window as unknown as { documentPictureInPicture: DocumentPictureInPictureAPI })
      .documentPictureInPicture;

    this.isOpening = true;
    try {
      const pipWin = await api.requestWindow({
        width: 320,
        height: 84
      });

      this.pipWindow = pipWin;
      this.buildDocument(pipWin);

      pipWin.addEventListener('pagehide', () => {
        this.handleClosed(pipWin);
      });

      this.options.onOpenChange(true);
      this.sync();
    } catch (err) {
      console.warn('Document Picture-in-Picture failed:', err);
      this.options.onUnsupportedOrError(
        'Could not open floating timer window in this browser.'
      );
    } finally {
      this.isOpening = false;
    }
  }

  public close(): void {
    const win = this.pipWindow;
    if (!win) return;
    try {
      if (!win.closed) {
        win.close();
      }
    } catch {
      // Ignore close errors if window is already detached
    }
    this.handleClosed(win);
  }

  public sync(): void {
    if (!this.isOpen()) return;
    const snap = this.updateView(Date.now());
    const needsLoop = snap.mode === 'clock' || snap.status === 'running';
    if (needsLoop) {
      this.startLoop();
    } else {
      this.stopLoop();
    }
  }

  private handleClosed(closedWin: DocumentPiPWindow): void {
    if (this.pipWindow !== closedWin) return;
    this.stopLoop();
    this.pipWindow = null;
    this.pillEl = null;
    this.timeEl = null;
    this.subEl = null;
    this.toggleBtn = null;
    this.progressTrackEl = null;
    this.progressFillEl = null;
    this.lastMainText = '';
    this.lastSubText = '';
    this.lastBtnModeKey = '';
    this.options.onOpenChange(false);
  }

  private copyFontsAndStyles(pipWin: DocumentPiPWindow): void {
    const head = pipWin.document.head;
    const baseHref = window.location.href;
    const fontRules: string[] = [];

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const sheetBase = sheet.href || baseHref;
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule.cssText.trimStart().startsWith('@font-face')) {
            const rewritten = rule.cssText.replace(
              /url\((['"]?)([^)'"]+)\1\)/g,
              (_match, quote: string, rawUrl: string) => {
                if (rawUrl.startsWith('data:') || rawUrl.startsWith('http')) {
                  return `url(${quote}${rawUrl}${quote})`;
                }
                try {
                  return `url(${quote}${new URL(rawUrl, sheetBase).href}${quote})`;
                } catch {
                  return `url(${quote}${rawUrl}${quote})`;
                }
              }
            );
            fontRules.push(rewritten);
          }
        }
      } catch {
        if (sheet.href) {
          const link = pipWin.document.createElement('link');
          link.rel = 'stylesheet';
          link.href = sheet.href;
          head.appendChild(link);
        }
      }
    }

    if (fontRules.length > 0) {
      const fontStyle = pipWin.document.createElement('style');
      fontStyle.textContent = fontRules.join('\n');
      head.appendChild(fontStyle);
    }

    const pipStyle = pipWin.document.createElement('style');
    pipStyle.textContent = PIP_STYLES;
    head.appendChild(pipStyle);
  }

  private buildDocument(pipWin: DocumentPiPWindow): void {
    const doc = pipWin.document;
    doc.title = 'Tempo';
    this.copyFontsAndStyles(pipWin);

    doc.body.innerHTML = `
      <div class="island-stage">
        <div class="island-pill" role="region" aria-label="Floating timer">
          <div class="island-left">
            <span class="island-dot" aria-hidden="true"></span>
            <div class="island-time-wrap">
              <span class="island-time">00:00:00</span><span class="island-sub"></span>
            </div>
          </div>
          <div class="island-actions">
            <button class="island-btn island-btn-toggle" type="button" aria-label="Start" title="Start"></button>
            <button class="island-btn island-btn-close" type="button" aria-label="Close floating timer" title="Close">
              ${CLOSE_ICON}
            </button>
          </div>
          <div class="island-progress-track" style="display: none;">
            <div class="island-progress-fill"></div>
          </div>
        </div>
      </div>
    `;

    this.pillEl = doc.querySelector('.island-pill');
    this.timeEl = doc.querySelector('.island-time');
    this.subEl = doc.querySelector('.island-sub');
    this.toggleBtn = doc.querySelector('.island-btn-toggle');
    this.progressTrackEl = doc.querySelector('.island-progress-track');
    this.progressFillEl = doc.querySelector('.island-progress-fill');
    const closeBtn = doc.querySelector('.island-btn-close');

    this.toggleBtn?.addEventListener('click', () => {
      this.options.onToggleStartPause();
    });

    closeBtn?.addEventListener('click', () => {
      this.close();
    });

    doc.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === ' ' || e.code === 'Space') {
        if (doc.activeElement?.tagName === 'BUTTON') return;
        e.preventDefault();
        this.options.onToggleStartPause();
      }
    });
  }

  private startLoop(): void {
    if (this.rafId !== null || !this.pipWindow) return;
    const win = this.pipWindow;

    const tick = () => {
      if (!this.isOpen() || this.pipWindow !== win) {
        this.rafId = null;
        return;
      }

      const snap = this.updateView(Date.now());
      if (snap.mode === 'countdown' && snap.status === 'running' && snap.displayMs === 0) {
        this.rafId = null;
        this.options.onCountdownComplete();
        return;
      }

      const keepTicking = snap.mode === 'clock' || snap.status === 'running';
      if (keepTicking) {
        this.rafId = win.requestAnimationFrame(tick);
      } else {
        this.rafId = null;
      }
    };

    this.rafId = win.requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null && this.pipWindow) {
      this.pipWindow.cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
  }

  private updateView(nowEpoch: number): FloatingTimerSnapshot {
    const snap = this.options.getSnapshot(nowEpoch);
    if (!this.pillEl || !this.timeEl || !this.subEl || !this.toggleBtn) {
      return snap;
    }

    this.pillEl.classList.toggle('is-running', snap.status === 'running');
    this.pillEl.classList.toggle('is-paused', snap.status === 'paused');
    this.pillEl.classList.toggle('is-idle', snap.status === 'idle');
    this.pillEl.classList.toggle('is-done', snap.status === 'done');

    const { main, sub } = formatFloatingTime(snap.displayMs, snap.mode);
    if (this.lastMainText !== main) {
      this.timeEl.textContent = main;
      this.lastMainText = main;
    }
    if (this.lastSubText !== sub) {
      this.subEl.textContent = sub;
      this.lastSubText = sub;
    }

    if (this.progressTrackEl && this.progressFillEl) {
      if (snap.mode === 'countdown' && snap.status !== 'idle' && typeof snap.progress === 'number') {
        const clampedProgress = Math.max(0, Math.min(1, snap.progress));
        this.progressTrackEl.style.display = 'block';
        this.progressFillEl.style.transform = `scaleX(${clampedProgress})`;
      } else {
        this.progressTrackEl.style.display = 'none';
      }
    }

    const btnKey = `${snap.mode}:${snap.status}:${snap.canStart}`;
    if (this.lastBtnModeKey !== btnKey) {
      this.lastBtnModeKey = btnKey;
      if (snap.mode === 'clock') {
        this.toggleBtn.style.display = 'none';
      } else {
        this.toggleBtn.style.display = 'inline-flex';
        if (snap.status === 'running') {
          this.toggleBtn.innerHTML = PAUSE_ICON;
          this.toggleBtn.classList.add('is-secondary');
          this.toggleBtn.setAttribute('aria-label', 'Pause');
          this.toggleBtn.title = 'Pause';
          this.toggleBtn.disabled = false;
        } else if (snap.status === 'done') {
          this.toggleBtn.innerHTML = CHECK_ICON;
          this.toggleBtn.classList.remove('is-secondary');
          this.toggleBtn.setAttribute('aria-label', 'Dismiss');
          this.toggleBtn.title = 'Dismiss';
          this.toggleBtn.disabled = false;
        } else {
          const label = snap.status === 'paused' ? 'Resume' : 'Start';
          this.toggleBtn.innerHTML = PLAY_ICON;
          this.toggleBtn.classList.remove('is-secondary');
          this.toggleBtn.setAttribute('aria-label', label);
          this.toggleBtn.title = label;
          this.toggleBtn.disabled = !snap.canStart;
        }
      }
    }

    return snap;
  }
}
