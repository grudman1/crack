import { describe, it, expect } from 'vitest';
import { ALPHABET } from '@/services/sentenceService';

describe('sentenceService', () => {
  it('ALPHABET has 26 entries in order', () => {
    expect(ALPHABET).toHaveLength(26);
    expect(ALPHABET[0]).toBe('A');
    expect(ALPHABET[25]).toBe('Z');
  });
});
