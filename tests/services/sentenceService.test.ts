import { describe, it, expect } from 'vitest';
import {
  ALPHABET,
  SENTENCES,
  generateRoundLetters,
  lettersFromSentence,
} from '@/services/sentenceService';

describe('sentenceService', () => {
  it('generateRoundLetters returns 26 uppercase letters', () => {
    for (let i = 0; i < 50; i++) {
      const { letters } = generateRoundLetters();
      expect(letters).toHaveLength(26);
      expect(letters).toMatch(/^[A-Z]{26}$/);
    }
  });

  it('lettersFromSentence strips and uppercases', () => {
    const out = lettersFromSentence('Hello, world! This is a test of forty characters or so right here.');
    expect(out).toHaveLength(26);
    expect(out).toMatch(/^[A-Z]{26}$/);
  });

  it('lettersFromSentence concatenates when source is short', () => {
    const out = lettersFromSentence('Hi.');
    expect(out).toHaveLength(26);
    expect(out).toMatch(/^[A-Z]{26}$/);
  });

  it('ALPHABET has 26 entries in order', () => {
    expect(ALPHABET).toHaveLength(26);
    expect(ALPHABET[0]).toBe('A');
    expect(ALPHABET[25]).toBe('Z');
  });

  it('sentence pool is non-empty', () => {
    expect(SENTENCES.length).toBeGreaterThan(20);
  });
});
