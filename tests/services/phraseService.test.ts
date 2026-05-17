import { describe, it, expect } from 'vitest';
import { PHRASES } from '@/data/phrases';
import { normalize, findPhraseByLetters, generateRound } from '@/services/phraseService';

describe('phraseService', () => {
  it('has at least 1000 phrases', () => {
    expect(PHRASES.length).toBeGreaterThanOrEqual(1000);
  });

  it('every phrase has letters === normalize(text) and length >= 26', () => {
    for (const p of PHRASES) {
      expect(p.letters).toBe(normalize(p.text));
      expect(p.letters.length).toBeGreaterThanOrEqual(26);
    }
  });

  it('every phrase has a Wikipedia URL', () => {
    for (const p of PHRASES) {
      expect(p.wikipediaUrl).toMatch(/^https:\/\/en\.wikipedia\.org\//);
    }
  });

  it('lettersForRound returns exactly 26 uppercase characters', () => {
    for (let i = 0; i < 10; i++) {
      const r = generateRound();
      expect(r.letters).toHaveLength(26);
      expect(r.letters).toMatch(/^[A-Z]{26}$/);
    }
  });

  it('round letters match the phrase letters (uppercased)', () => {
    const r = generateRound();
    expect(r.letters).toBe(r.phrase.letters.slice(0, 26).toUpperCase());
  });

  it('findPhraseByLetters round-trips', () => {
    const sample = PHRASES[Math.floor(PHRASES.length / 2)]!;
    const found = findPhraseByLetters(sample.letters);
    expect(found?.text).toBe(sample.text);
  });

  it('normalize strips spaces, punctuation, numerals, apostrophes, accents', () => {
    expect(normalize("Frankly, my dear, I don't give a damn.")).toBe(
      'franklymydearidontgiveadamn',
    );
    expect(normalize('Café 24/7!')).toBe('cafe');
  });

  it('source types are within the declared union', () => {
    const allowed = new Set(['literature', 'film', 'tv', 'speech', 'song', 'historical', 'idiom']);
    for (const p of PHRASES) {
      expect(allowed.has(p.sourceType)).toBe(true);
    }
  });
});
