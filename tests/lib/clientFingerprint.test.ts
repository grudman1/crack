import { describe, it, expect, beforeEach } from 'vitest';
import { getClientFingerprint } from '@/lib/clientFingerprint';

describe('getClientFingerprint', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns a UUID-shaped string', () => {
    const id = getClientFingerprint();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('returns the same value on repeated calls (persisted)', () => {
    const a = getClientFingerprint();
    const b = getClientFingerprint();
    expect(a).toBe(b);
  });

  it('writes to localStorage under crack:client_id', () => {
    const id = getClientFingerprint();
    expect(localStorage.getItem('crack:client_id')).toBe(id);
  });
});
