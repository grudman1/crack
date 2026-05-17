// Per-device round counter, persisted in localStorage. Incremented on
// every Start round and surfaced on the homepage + results as "Round
// No. {n}". Lays the groundwork for a future daily-puzzle mode.

const KEY = 'crack:round_counter';

export function getRoundNumber(): number {
  if (typeof localStorage === 'undefined') return 1;
  try {
    const raw = localStorage.getItem(KEY);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 1;
  } catch {
    return 1;
  }
}

export function incrementRoundNumber(): number {
  if (typeof localStorage === 'undefined') return 1;
  try {
    const current = getRoundNumber();
    const next = current + 1;
    localStorage.setItem(KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

export function formatToday(date = new Date()): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
