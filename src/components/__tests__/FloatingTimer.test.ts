import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FloatingTimer,
  formatFloatingTime,
  isDocumentPiPSupported,
  type FloatingTimerSnapshot
} from '../FloatingTimer';

interface FakeElement {
  tagName: string;
  className: string;
  textContent: string | null;
  innerHTML: string;
  style: Record<string, string>;
  disabled: boolean;
  title: string;
  attributes: Record<string, string>;
  listeners: Record<string, Array<(e?: any) => void>>;
  classList: {
    contains: (cls: string) => boolean;
    add: (cls: string) => void;
    remove: (cls: string) => void;
    toggle: (cls: string, force?: boolean) => void;
  };
  setAttribute: (k: string, v: string) => void;
  getAttribute: (k: string) => string | null;
  addEventListener: (type: string, cb: (e?: any) => void) => void;
  dispatchEvent: (type: string, event?: any) => void;
  appendChild: (child: FakeElement) => FakeElement;
}

function createFakeElement(tagName = 'div', className = ''): FakeElement {
  const classes = new Set(className ? className.split(' ') : []);
  const listeners: Record<string, Array<(e?: any) => void>> = {};
  const attributes: Record<string, string> = {};

  const el: FakeElement = {
    tagName: tagName.toUpperCase(),
    className,
    textContent: '',
    innerHTML: '',
    style: {},
    disabled: false,
    title: '',
    attributes,
    listeners,
    classList: {
      contains: (cls: string) => classes.has(cls),
      add: (cls: string) => {
        classes.add(cls);
      },
      remove: (cls: string) => {
        classes.delete(cls);
      },
      toggle: (cls: string, force?: boolean) => {
        if (force === undefined) {
          if (classes.has(cls)) classes.delete(cls);
          else classes.add(cls);
        } else if (force) {
          classes.add(cls);
        } else {
          classes.delete(cls);
        }
      }
    },
    setAttribute: (k: string, v: string) => {
      attributes[k] = v;
    },
    getAttribute: (k: string) => attributes[k] ?? null,
    addEventListener: (type: string, cb: (e?: any) => void) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(cb);
    },
    dispatchEvent: (type: string, event?: any) => {
      for (const cb of listeners[type] ?? []) cb(event);
    },
    appendChild: (child: FakeElement) => child
  };

  return el;
}

function createFakePiPWindow() {
  const pill = createFakeElement('div', 'island-pill');
  const timeEl = createFakeElement('span', 'island-time');
  const subEl = createFakeElement('span', 'island-sub');
  const toggleBtn = createFakeElement('button', 'island-btn island-btn-toggle');
  const closeBtn = createFakeElement('button', 'island-btn island-btn-close');
  const progressTrack = createFakeElement('div', 'island-progress-track');
  const progressFill = createFakeElement('div', 'island-progress-fill');

  const docListeners: Record<string, Array<(e?: any) => void>> = {};
  const winListeners: Record<string, Array<(e?: any) => void>> = {};
  const rafQueue = new Map<number, FrameRequestCallback>();
  let nextRafId = 1;

  const pipDocument = {
    title: '',
    activeElement: null as FakeElement | null,
    head: createFakeElement('head'),
    body: {
      innerHTML: ''
    },
    createElement: (tag: string) => createFakeElement(tag),
    querySelector: (selector: string) => {
      switch (selector) {
        case '.island-pill':
          return pill;
        case '.island-time':
          return timeEl;
        case '.island-sub':
          return subEl;
        case '.island-btn-toggle':
          return toggleBtn;
        case '.island-btn-close':
          return closeBtn;
        case '.island-progress-track':
          return progressTrack;
        case '.island-progress-fill':
          return progressFill;
        default:
          return null;
      }
    },
    addEventListener: (type: string, cb: (e?: any) => void) => {
      if (!docListeners[type]) docListeners[type] = [];
      docListeners[type].push(cb);
    }
  };

  const pipWin = {
    closed: false,
    document: pipDocument,
    elements: {
      pill,
      timeEl,
      subEl,
      toggleBtn,
      closeBtn,
      progressTrack,
      progressFill
    },
    addEventListener: (type: string, cb: (e?: any) => void) => {
      if (!winListeners[type]) winListeners[type] = [];
      winListeners[type].push(cb);
    },
    requestAnimationFrame: (cb: FrameRequestCallback) => {
      const id = nextRafId++;
      rafQueue.set(id, cb);
      return id;
    },
    cancelAnimationFrame: (id: number) => {
      rafQueue.delete(id);
    },
    flushFrame: (ts = 16) => {
      const entries = Array.from(rafQueue.entries());
      rafQueue.clear();
      for (const [, cb] of entries) cb(ts);
    },
    close: () => {
      if (pipWin.closed) return;
      pipWin.closed = true;
      for (const cb of winListeners['pagehide'] ?? []) cb();
    },
    triggerKeyDown: (key: string) => {
      const event = { key, code: key === ' ' ? 'Space' : key, preventDefault: vi.fn() };
      for (const cb of docListeners['keydown'] ?? []) cb(event);
      return event;
    }
  };

  return pipWin;
}

describe('FloatingTimer', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { styleSheets: [] });
    vi.stubGlobal('window', {
      location: { origin: 'https://example.com', href: 'https://example.com/' }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('formatFloatingTime', () => {
    it('formats stopwatch time as HH:MM:SS + .cc', () => {
      expect(formatFloatingTime(0, 'stopwatch')).toEqual({
        main: '00:00:00',
        sub: '.00'
      });
      expect(formatFloatingTime(3661459, 'stopwatch')).toEqual({
        main: '01:01:01',
        sub: '.45'
      });
    });

    it('formats countdown time with ceil rounding matching CountdownClock', () => {
      expect(formatFloatingTime(10000, 'countdown')).toEqual({
        main: '00:00:10',
        sub: ''
      });
      expect(formatFloatingTime(9001, 'countdown')).toEqual({
        main: '00:00:10',
        sub: ''
      });
      expect(formatFloatingTime(9000, 'countdown')).toEqual({
        main: '00:00:09',
        sub: ''
      });
      expect(formatFloatingTime(0, 'countdown')).toEqual({
        main: '00:00:00',
        sub: ''
      });
    });

    it('formats clock time in 12-hour format with AM/PM', () => {
      const afternoonMs = (14 * 3600 + 5 * 60 + 9) * 1000;
      expect(formatFloatingTime(afternoonMs, 'clock')).toEqual({
        main: '02:05:09',
        sub: ' PM'
      });
    });
  });

  describe('browser support & fallback', () => {
    it('detects unsupported environments and shows fallback message without throwing', async () => {
      expect(isDocumentPiPSupported()).toBe(false);

      const onUnsupportedOrError = vi.fn();
      const timer = new FloatingTimer({
        getSnapshot: () => ({ mode: 'stopwatch', status: 'idle', displayMs: 0, canStart: true }),
        onToggleStartPause: vi.fn(),
        onCountdownComplete: vi.fn(),
        onOpenChange: vi.fn(),
        onUnsupportedOrError
      });

      await timer.open();
      expect(timer.isOpen()).toBe(false);
      expect(onUnsupportedOrError).toHaveBeenCalledTimes(1);
      expect(onUnsupportedOrError.mock.calls[0][0]).toMatch(/Chrome or Microsoft Edge/i);
    });

    it('handles requestWindow rejection gracefully', async () => {
      vi.stubGlobal('window', {
        location: { origin: 'https://example.com', href: 'https://example.com/' },
        documentPictureInPicture: {
          requestWindow: vi.fn().mockRejectedValue(new Error('NotAllowedError'))
        }
      });

      expect(isDocumentPiPSupported()).toBe(true);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onUnsupportedOrError = vi.fn();

      const timer = new FloatingTimer({
        getSnapshot: () => ({ mode: 'stopwatch', status: 'idle', displayMs: 0, canStart: true }),
        onToggleStartPause: vi.fn(),
        onCountdownComplete: vi.fn(),
        onOpenChange: vi.fn(),
        onUnsupportedOrError
      });

      await timer.open();
      expect(timer.isOpen()).toBe(false);
      expect(onUnsupportedOrError).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });
  });

  describe('PiP lifecycle and synchronization', () => {
    it('opens PiP window, renders running stopwatch, toggles pause/resume, and closes cleanly', async () => {
      const pipWin = createFakePiPWindow();
      const requestWindow = vi.fn().mockResolvedValue(pipWin);
      vi.stubGlobal('window', {
        location: { origin: 'https://example.com', href: 'https://example.com/' },
        documentPictureInPicture: { requestWindow }
      });

      let snapshot: FloatingTimerSnapshot = {
        mode: 'stopwatch',
        status: 'running',
        displayMs: 12340,
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

      const timer = new FloatingTimer({
        getSnapshot: () => snapshot,
        onToggleStartPause,
        onCountdownComplete: vi.fn(),
        onOpenChange,
        onUnsupportedOrError: vi.fn()
      });

      await timer.toggle();
      expect(requestWindow).toHaveBeenCalledWith({ width: 320, height: 84 });
      expect(timer.isOpen()).toBe(true);
      expect(onOpenChange).toHaveBeenCalledWith(true);

      expect(pipWin.elements.timeEl.textContent).toBe('00:00:12');
      expect(pipWin.elements.subEl.textContent).toBe('.34');
      expect(pipWin.elements.pill.classList.contains('is-running')).toBe(true);
      expect(pipWin.elements.toggleBtn.getAttribute('aria-label')).toBe('Pause');

      // Simulate time advancing on a subsequent PiP frame
      snapshot = { ...snapshot, displayMs: 15890 };
      pipWin.flushFrame();
      expect(pipWin.elements.timeEl.textContent).toBe('00:00:15');
      expect(pipWin.elements.subEl.textContent).toBe('.89');

      // Pause from inside floating window
      pipWin.elements.toggleBtn.dispatchEvent('click');
      expect(onToggleStartPause).toHaveBeenCalledTimes(1);
      expect(pipWin.elements.pill.classList.contains('is-paused')).toBe(true);
      expect(pipWin.elements.toggleBtn.getAttribute('aria-label')).toBe('Resume');

      // Close via floating close button leaves main timer untouched
      pipWin.elements.closeBtn.dispatchEvent('click');
      expect(timer.isOpen()).toBe(false);
      expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });

    it('synchronizes countdown progress and triggers completion when remaining reaches 0', async () => {
      const pipWin = createFakePiPWindow();
      vi.stubGlobal('window', {
        location: { origin: 'https://example.com', href: 'https://example.com/' },
        documentPictureInPicture: {
          requestWindow: vi.fn().mockResolvedValue(pipWin)
        }
      });

      let snapshot: FloatingTimerSnapshot = {
        mode: 'countdown',
        status: 'running',
        displayMs: 5000,
        canStart: true,
        progress: 0.5
      };

      const onCountdownComplete = vi.fn(() => {
        snapshot = { ...snapshot, status: 'done', displayMs: 0, progress: 0 };
        timer.sync();
      });

      const timer = new FloatingTimer({
        getSnapshot: () => snapshot,
        onToggleStartPause: vi.fn(),
        onCountdownComplete,
        onOpenChange: vi.fn(),
        onUnsupportedOrError: vi.fn()
      });

      await timer.open();
      expect(pipWin.elements.timeEl.textContent).toBe('00:00:05');
      expect(pipWin.elements.progressTrack.style.display).toBe('block');
      expect(pipWin.elements.progressFill.style.transform).toBe('scaleX(0.5)');

      snapshot = { ...snapshot, displayMs: 0, progress: 0 };
      pipWin.flushFrame();

      expect(onCountdownComplete).toHaveBeenCalledTimes(1);
      expect(pipWin.elements.pill.classList.contains('is-done')).toBe(true);
      expect(pipWin.elements.toggleBtn.getAttribute('aria-label')).toBe('Dismiss');
    });
  });
});

