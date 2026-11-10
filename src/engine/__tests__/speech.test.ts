import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SpeechSpeaker,
  selectBestEnglishVoice,
  isSpeechSupported
} from '../speech';

class FakeUtterance {
  public text: string;
  public lang = '';
  public voice: SpeechSynthesisVoice | null = null;
  public rate = 1;
  public pitch = 1;
  public volume = 1;
  public onerror: ((e: { error: string }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

describe('speech engine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('handles unavailable speech synthesis gracefully', () => {
    vi.stubGlobal('window', {});
    expect(isSpeechSupported()).toBe(false);

    const speaker = new SpeechSpeaker();
    expect(() => speaker.prime()).not.toThrow();
    expect(() => speaker.speak('1 minute left')).not.toThrow();
    expect(() => speaker.cancel()).not.toThrow();
    speaker.destroy();
  });

  it('selects natural English voices and prefers local voices when offline', () => {
    const voices = [
      { name: 'French', lang: 'fr-FR', default: false, localService: true, voiceURI: 'fr' },
      { name: 'Google US English', lang: 'en-US', default: false, localService: false, voiceURI: 'gus' },
      { name: 'Microsoft Aria Online (Natural)', lang: 'en-US', default: false, localService: false, voiceURI: 'aria' },
      { name: 'Microsoft Zira Desktop', lang: 'en-US', default: true, localService: true, voiceURI: 'zira' }
    ] as unknown as SpeechSynthesisVoice[];

    expect(selectBestEnglishVoice(voices, false)?.name).toBe(
      'Microsoft Aria Online (Natural)'
    );
    expect(selectBestEnglishVoice(voices, true)?.name).toBe(
      'Microsoft Zira Desktop'
    );
  });

  it('primes speech, avoids overlapping utterances, cancels pending speech, and notifies once if blocked', () => {
    const spoken: FakeUtterance[] = [];
    const synthMock = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: vi.fn(() => [
        { name: 'Samantha', lang: 'en-US', default: true, localService: true, voiceURI: 'sam' }
      ]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      speak: vi.fn((u: FakeUtterance) => {
        spoken.push(u);
      }),
      cancel: vi.fn(() => {
        synthMock.speaking = false;
        synthMock.pending = false;
      }),
      resume: vi.fn()
    };

    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('window', { speechSynthesis: synthMock });
    vi.stubGlobal('navigator', { onLine: true });

    const onBlocked = vi.fn();
    const speaker = new SpeechSpeaker({ onBlocked });

    speaker.prime();
    expect(spoken).toHaveLength(1);
    expect(spoken[0].volume).toBe(0);

    // Triggering a not-allowed error notifies once; canceled/interrupted are ignored
    spoken[0].onerror?.({ error: 'canceled' });
    expect(onBlocked).not.toHaveBeenCalled();
    spoken[0].onerror?.({ error: 'not-allowed' });
    spoken[0].onerror?.({ error: 'not-allowed' });
    expect(onBlocked).toHaveBeenCalledTimes(1);

    // Idle speak executes synchronously with chosen English voice
    speaker.speak('5 minutes left');
    expect(spoken).toHaveLength(2);
    expect(spoken[1].text).toBe('5 minutes left');
    expect(spoken[1].rate).toBe(1.05);
    expect(spoken[1].voice?.name).toBe('Samantha');

    // Overlapping speak cancels active speech first and yields briefly
    synthMock.speaking = true;
    speaker.speak('9', { urgent: true });
    expect(synthMock.cancel).toHaveBeenCalledTimes(1);
    expect(spoken).toHaveLength(2);

    vi.advanceTimersByTime(25);
    expect(spoken).toHaveLength(3);
    expect(spoken[2].text).toBe('9');
    expect(spoken[2].rate).toBe(1.15);

    // Cancelling before delayed speak fires prevents orphaned utterance
    synthMock.speaking = true;
    speaker.speak('8', { urgent: true });
    speaker.cancel();
    vi.advanceTimersByTime(50);
    expect(spoken).toHaveLength(3);

    speaker.destroy();
  });
});
