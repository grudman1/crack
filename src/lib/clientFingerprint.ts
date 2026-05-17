// Persistent per-browser UUID used as an abuse signal on review
// submissions. NOT a security measure — anyone can clear localStorage or
// rotate browsers — just a low-friction way to cluster spam later.
//
// If localStorage is unavailable (private mode, CSP, etc.), we return a
// fresh UUID per call. The downstream consumer doesn't differentiate
// between "couldn't persist" and "first visit," so this is fine.

const KEY = 'crack:client_id';

function makeId(): string {
  // crypto.randomUUID is universally available in the browsers we
  // target (and in Node 19+). Guard for tests / very old envs anyway.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: 16 bytes of pseudo-randomness, RFC-4122 v4 shaped.
  const bytes = new Array(16).fill(0).map(() => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getClientFingerprint(): string {
  try {
    if (typeof localStorage === 'undefined') return makeId();
    const existing = localStorage.getItem(KEY);
    if (existing && existing.length >= 32) return existing;
    const fresh = makeId();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Storage access threw (private mode, SecurityError, quota). Return a
    // throwaway ID — better than crashing the submit flow.
    return makeId();
  }
}
