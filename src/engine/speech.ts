export interface SpeechOptions {
  onBlocked?: () => void;
}

export interface SpeakParams {
  urgent?: boolean;
}

export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.speechSynthesis?.speak === 'function' &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

export function selectBestEnglishVoice(
  voices: readonly SpeechSynthesisVoice[],
  offline = typeof navigator !== 'undefined' && navigator.onLine === false
): SpeechSynthesisVoice | null {
  const englishVoices = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  if (englishVoices.length === 0) return null;

  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -Infinity;

  for (const voice of englishVoices) {
    let score = 0;
    const name = voice.name.toLowerCase();
    const lang = voice.lang.toLowerCase();

    if (/natural|neural|online/.test(name)) score += 100;
    if (/google us english|google uk english/.test(name)) score += 80;
    if (
      /samantha|daniel|karen|serena|aria|jenny|guy|libby|sonia|ryan|zira|david|mark/.test(
        name
      )
    ) {
      score += 55;
    }

    if (lang === 'en-us' || lang === 'en_us') score += 20;
    else if (lang === 'en-gb' || lang === 'en_gb') score += 15;

    if (voice.default) score += 10;

    if (offline) {
      score += voice.localService ? 150 : -150;
    } else if (voice.localService) {
      score += 12;
    }

    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }

  return best;
}

export class SpeechSpeaker {
  private options: SpeechOptions;
  private cachedVoice: SpeechSynthesisVoice | null = null;
  private generation = 0;
  private delayedSpeakTimer: ReturnType<typeof setTimeout> | null = null;
  private hasNotifiedBlocked = false;
  private voicesChangedHandler: (() => void) | null = null;

  constructor(options: SpeechOptions = {}) {
    this.options = options;
    this.attachVoiceListener();
  }

  private attachVoiceListener(): void {
    if (!isSpeechSupported()) return;
    const synth = window.speechSynthesis;
    this.refreshVoice();
    if (typeof synth.addEventListener === 'function') {
      this.voicesChangedHandler = () => {
        this.refreshVoice();
      };
      synth.addEventListener('voiceschanged', this.voicesChangedHandler);
    }
  }

  public refreshVoice(): SpeechSynthesisVoice | null {
    if (!isSpeechSupported()) return null;
    try {
      const voices = window.speechSynthesis.getVoices();
      this.cachedVoice = selectBestEnglishVoice(voices);
    } catch {
      this.cachedVoice = null;
    }
    return this.cachedVoice;
  }

  public prime(): void {
    if (!isSpeechSupported()) return;
    this.hasNotifiedBlocked = false;
    try {
      const synth = window.speechSynthesis;
      if (synth.speaking || synth.pending) return;

      const primer = new SpeechSynthesisUtterance(' ');
      primer.volume = 0;
      primer.rate = 10;
      primer.lang = this.cachedVoice?.lang || 'en-US';
      if (this.cachedVoice) {
        primer.voice = this.cachedVoice;
      }
      primer.onerror = (event: SpeechSynthesisErrorEvent) => {
        if (event.error === 'not-allowed') {
          this.notifyBlocked();
        }
      };
      synth.speak(primer);
    } catch {
      // Ignore synthesis priming failures on restrictive browsers
    }
  }

  public speak(text: string, params: SpeakParams = {}): void {
    if (!isSpeechSupported() || !text.trim()) return;

    this.clearDelayedTimer();
    const currentGen = ++this.generation;

    try {
      const synth = window.speechSynthesis;
      const voice = this.cachedVoice ?? this.refreshVoice();

      const performSpeak = () => {
        if (currentGen !== this.generation || !isSpeechSupported()) return;
        try {
          if (synth.paused) {
            synth.resume();
          }
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = voice?.lang || 'en-US';
          if (voice) {
            utterance.voice = voice;
          }
          utterance.rate = params.urgent ? 1.15 : 1.05;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
            if (event.error === 'canceled' || event.error === 'interrupted') {
              return;
            }
            if (event.error === 'not-allowed') {
              this.notifyBlocked();
            }
          };
          synth.speak(utterance);
        } catch {
          // Ignore synthesis errors gracefully
        }
      };

      if (synth.speaking || synth.pending) {
        synth.cancel();
        // Brief yield avoids Chrome dropping an utterance queued immediately after cancel()
        this.delayedSpeakTimer = setTimeout(() => {
          this.delayedSpeakTimer = null;
          performSpeak();
        }, 20);
      } else {
        performSpeak();
      }
    } catch {
      // Ignore Web Speech API failures cleanly
    }
  }

  public cancel(): void {
    this.generation++;
    this.clearDelayedTimer();
    if (!isSpeechSupported()) return;
    try {
      const synth = window.speechSynthesis;
      if (synth.speaking || synth.pending) {
        synth.cancel();
      }
    } catch {
      // Ignore cancellation errors
    }
  }

  public destroy(): void {
    this.cancel();
    if (
      isSpeechSupported() &&
      this.voicesChangedHandler &&
      typeof window.speechSynthesis.removeEventListener === 'function'
    ) {
      window.speechSynthesis.removeEventListener(
        'voiceschanged',
        this.voicesChangedHandler
      );
    }
    this.voicesChangedHandler = null;
  }

  private clearDelayedTimer(): void {
    if (this.delayedSpeakTimer !== null) {
      clearTimeout(this.delayedSpeakTimer);
      this.delayedSpeakTimer = null;
    }
  }

  private notifyBlocked(): void {
    if (this.hasNotifiedBlocked) return;
    this.hasNotifiedBlocked = true;
    this.options.onBlocked?.();
  }
}
