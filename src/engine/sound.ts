type AudioContextCtor = typeof AudioContext;

let audioCtx: AudioContext | null = null;

function getAudioContextConstructor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

export function unlockCompletionAudio(): void {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return;
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new Ctor();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume().catch(() => {});
    }
  } catch {
    // Ignore audio context restrictions gracefully
  }
}

export function playCompletionSound(): void {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return;

  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new Ctor();
    }
    const ctx = audioCtx;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    const start = ctx.currentTime;
    const notes = [
      { freq: 880, offset: 0, duration: 0.42, peak: 0.2 },
      { freq: 1318.51, offset: 0.14, duration: 0.56, peak: 0.18 },
      { freq: 880, offset: 0.62, duration: 0.42, peak: 0.18 },
      { freq: 1318.51, offset: 0.76, duration: 0.62, peak: 0.16 }
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = start + note.offset;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, t0);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(note.peak, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0);
      osc.stop(t0 + note.duration + 0.02);
    }
  } catch {
    // Fail gracefully if audio playback is unavailable
  }
}
