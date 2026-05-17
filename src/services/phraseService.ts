// Phrase pool + round-seeding logic.
//
// A "phrase" is a famous quote / line / saying drawn from Wikiquote at
// build time (see scripts/seedPhrases.py). Every phrase carries:
//   - text:         display string (sentence-case, original punctuation)
//   - source:       what the phrase is from (film/book/show/speaker)
//   - sourceType:   category bucket used for filtering / stats
//   - wikipediaUrl: HEAD-verified link to the Wikipedia article
//   - letters:      normalized letters (strip non-letters, lowercase),
//                   guaranteed ≥ 26 characters. The kth character drives
//                   row k's second initial for the round.
//
// Round seeding uses a localStorage exclusion list (last 30 phrases) so
// the same phrase doesn't repeat too soon.

import { PHRASES } from '@/data/phrases';

export type SourceType = 'literature' | 'film' | 'tv' | 'speech' | 'song' | 'historical' | 'idiom';

export interface Phrase {
  text: string;
  source: string;
  sourceType: SourceType;
  wikipediaUrl: string;
  letters: string;
}

export const ALPHABET: string[] = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

const RECENT_KEY = 'crack:recent-phrases';
const RECENT_CAP = 30;

export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toLowerCase();
}

export function lettersForRound(phrase: Phrase): string {
  return phrase.letters.slice(0, 26).toUpperCase();
}

function readRecent(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as unknown[]).filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: string[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(-RECENT_CAP)));
  } catch {
    /* quota / disabled — ignore */
  }
}

function phraseId(p: Phrase): string {
  return p.letters;
}

export function pickPhrase(): Phrase {
  if (PHRASES.length === 0) {
    throw new Error('Phrase pool is empty — re-run scripts/seedPhrases.py');
  }
  const recent = new Set(readRecent());
  let pool = PHRASES.filter((p) => !recent.has(phraseId(p)));
  if (pool.length === 0) pool = PHRASES;
  const choice = pool[Math.floor(Math.random() * pool.length)]!;
  writeRecent([...recent, phraseId(choice)]);
  return choice;
}

export function findPhraseByLetters(letters: string): Phrase | null {
  const key = letters.toLowerCase();
  return PHRASES.find((p) => p.letters === key) ?? null;
}

export interface Round {
  phrase: Phrase;
  letters: string; // 26 uppercase chars driving the round
}

export function generateRound(): Round {
  const phrase = pickPhrase();
  return { phrase, letters: lettersForRound(phrase) };
}
