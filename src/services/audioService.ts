// WebAudio: tile-placement beep and end-of-round chime.

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

function envelope(osc: OscillatorNode, gain: GainNode, peak: number, attack: number, release: number, when: number) {
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(peak, when + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + attack + release);
  osc.start(when);
  osc.stop(when + attack + release + 0.05);
}

export function playBeep(frequency = 660) {
  const ac = ensureCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  osc.connect(gain).connect(ac.destination);
  envelope(osc, gain, 0.08, 0.005, 0.08, ac.currentTime);
}

export function playChime() {
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
