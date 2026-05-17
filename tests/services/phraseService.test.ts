import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PHRASES } from '@/data/phrases';
import {
  normalize,
  findPhraseByLetters,
  generateRound,
  pickPhrase,
} from '@/services/phraseService';

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

describe('pickPhrase — no back-to-back repeats', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('with working storage, 30 consecutive picks return 30 distinct phrases', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 30; i++) {
      ids.add(pickPhrase().letters);
    }
    expect(ids.size).toBe(30);
  });

  // Regression test for the production bug: when localStorage.setItem
  // silently fails (iOS Private mode, ITP purge, quota), every pick
  // saw an empty `recent` list and could return the prior phrase.
  it('with localStorage.setItem throwing, two consecutive picks are still distinct', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    // Pin Math.random so both calls would otherwise hit the same index.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const first = pickPhrase();
    const second = pickPhrase();
    expect(second.letters).not.toBe(first.letters);
  });

  // Run many iterations under broken storage — the guarantee has to
  // hold for every adjacent pair, not just one lucky run.
  it('with localStorage.setItem throwing, 100 consecutive picks have no back-to-back repeat', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    let prev = pickPhrase().letters;
    for (let i = 0; i < 99; i++) {
      const next = pickPhrase().letters;
      expect(next).not.toBe(prev);
      prev = next;
    }
  });

  it('with no localStorage at all, pickPhrase still avoids back-to-back repeats', () => {
    vi.stubGlobal('localStorage', undefined);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const first = pickPhrase();
    const second = pickPhrase();
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(second.letters).not.toBe(first.letters);
  });
});
