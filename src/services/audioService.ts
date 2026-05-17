// Solo audio + haptic feedback.
//
// Two surfaces, both routed through a single mute setting that the
// player toggles from the hamburger menu (persisted in
// localStorage['crack:audio-pref'] — 'on' default, 'off' suppresses
// everything below).
//
//   playKeystroke()  fires on every typed character. Audio-free — the
//                    old per-keystroke sine beep was unpleasant on
//                    fast typing. Now: a short haptic tap on devices
//                    that support navigator.vibrate (iOS Safari does
//                    not; that's fine, it's a no-op there).
//
//   playChime()      end-of-round arpeggio. The reward, kept as-is.
//
// resumeAudio() must still be called from a user gesture (start of
// round) so the AudioContext is allowed to make sound.

const MUTE_KEY = 'crack:audio-pref';
type Pref = 'on' | 'off';

function readPref(): Pref {
  if (typeof localStorage === 'undefined') return 'on';
  try {
    return localStorage.getItem(MUTE_KEY) === 'off' ? 'off' : 'on';
  } catch {
    return 'on';
  }
}

function writePref(p: Pref): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MUTE_KEY, p);
  } catch {
    /* quota / disabled — ignore */
  }
}

let muted = readPref() === 'off';
const subscribers = new Set<() => void>();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  if (muted === next) return;
  muted = next;
  writePref(next ? 'off' : 'on');
  subscribers.forEach((fn) => fn());
}

export function subscribeMuted(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

// ---- audio ----

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

function envelope(
  osc: OscillatorNode,
  gain: GainNode,
  peak: number,
  attack: number,
  release: number,
  when: number,
) {
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(peak, when + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + attack + release);
  osc.start(when);
  osc.stop(when + attack + release + 0.05);
}

export function playChime() {
  if (muted) return;
  const ac = ensureCtx();
  if (!ac) return;
  const notes = [523.25, 659.25, 783.99]; // C E G
  notes.forEach((n, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = n;
    osc.connect(gain).connect(ac.destination);
    envelope(osc, gain, 0.12, 0.01, 0.5, ac.currentTime + i * 0.12);
  });
}

export function resumeAudio() {
  const ac = ensureCtx();
  if (ac && ac.state === 'suspended') void ac.resume();
}

// ---- haptics ----

function vibrate(pattern: number | number[]): void {
  if (muted) return;
  if (typeof navigator === 'undefined') return;
  const nav = navigator as unknown as { vibrate?: (p: number | number[]) => boolean };
  if (typeof nav.vibrate !== 'function') return;
  try {
    nav.vibrate(pattern);
  } catch {
    /* swallow — best-effort */
  }
}

/** Fires on every typed character in Solo. Haptic-only by design. */
export function playKeystroke(): void {
  vibrate(8);
}
