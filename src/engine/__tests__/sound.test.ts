import { describe, it, expect, vi, afterEach } from 'vitest';
import { unlockCompletionAudio, playCompletionSound } from '../sound';

describe('sound engine', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails gracefully when AudioContext is unavailable', () => {
    vi.stubGlobal('window', {});
    expect(() => unlockCompletionAudio()).not.toThrow();
    expect(() => playCompletionSound()).not.toThrow();
  });

  it('unlocks audio and plays completion chime notes at zero', () => {
    const startMock = vi.fn();
    const stopMock = vi.fn();
    const resumeMock = vi.fn().mockResolvedValue(undefined);
    const createdOscs: number[] = [];

    class FakeAudioContext {
      public state: AudioContextState = 'suspended';
      public currentTime = 1.5;
      public destination = {};
      public resume = resumeMock;
      public createOscillator() {
        return {
          type: 'sine',
          frequency: {
            setValueAtTime: vi.fn((freq: number) => {
              createdOscs.push(freq);
            })
          },
          connect: vi.fn(),
          start: startMock,
          stop: stopMock
        };
      }
      public createGain() {
        return {
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn()
          },
          connect: vi.fn()
        };
      }
    }

    vi.stubGlobal('window', { AudioContext: FakeAudioContext });

    unlockCompletionAudio();
    expect(resumeMock).toHaveBeenCalledTimes(1);

    playCompletionSound();
    expect(createdOscs.length).toBeGreaterThanOrEqual(2);
    expect(startMock).toHaveBeenCalledTimes(createdOscs.length);
    expect(stopMock).toHaveBeenCalledTimes(createdOscs.length);
  });
});
