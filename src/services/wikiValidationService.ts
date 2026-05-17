// Validation pipeline for typed names against the round's letter pair.
//
// Hard gate (always strict):
//   - typed must have first AND last token
//   - typed initials must equal the round's expected pair — no fuzzing
//
// Soft chain (accept on first hit; FAMOUS_PEOPLE is the fast-path cache,
// not the source of truth — Wikipedia is the source of truth):
//   a) Local FAMOUS_PEOPLE for the pair → strict full-name fuzzy:
//        normalized full-name Lev ≤ 2
//        OR same first name + surname Lev ≤ 2 / phonetic
//   b) Wikipedia exact-title summary → standard page + person + matching initials
//   c) Wikipedia opensearch (typo-tolerant) — iterate top-8 hits, accept first
//      non-disambig page that is a person with matching initials
//   d) Prefix-with-connector on opensearch top-3 — "Queen Noor" → "Queen Noor of
//      Jordan" (connector word required after the typed prefix)
//   e) Disambig page handling (if step b returned a disambiguation page) —
//      iterate the disambig's links, accept first person with matching initials
//   f) Reject "couldn't verify"
//
// All Wikipedia + Wikidata responses are cached in-memory so 26 rows in a
// round don't hammer the API on repeats.

import { doubleMetaphone } from 'double-metaphone';
import { FAMOUS_PEOPLE } from '@/data/famousPeople';

export type ValidationStatus = 'valid' | 'invalid';

export interface ValidationResult {
  status: ValidationStatus;
  reason?: string;
  canonicalName?: string;
  wikipediaUrl?: string;
}

export interface ValidateOptions {
  expectedInitials?: string;
}

const SUFFIXES = new Set(['JR', 'SR', 'I', 'II', 'III', 'IV', 'V', 'PHD', 'MD', 'ESQ']);
const FICTIONAL_QIDS = new Set([
  'Q15632617',
  'Q95074',
  'Q3247054',
  'Q15773347',
  'Q21070568',
]);
const CONNECTOR_WORDS = new Set([
  'of',
  'the',
  'in',
  'from',
  'de',
  'del',
  'di',
  'da',
  'der',
  'van',
  'von',
  'al',
  'el',
  'la',
  'le',
]);

// --- text helpers ---------------------------------------------------------

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function stripParens(s: string): string {
  return s.replace(/\([^)]*\)/g, '');
}

function normalizeForCompare(s: string): string {
  return stripAccents(s ?? '')
    .replace(/[’'`]/g, '')
    .replace(/[.,;:]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function nameTokens(name: string): string[] {
  const cleaned = stripParens(stripAccents(name ?? '')).trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return parts.filter((p) => {
    const tok = p.toUpperCase().replace(/[.,;]+$/, '');
    return !SUFFIXES.has(tok);
  });
}

export function computeNameInitials(name: string): string {
  const tokens = nameTokens(name ?? '');
  if (tokens.length < 2) return '';
  const first = tokens[0]!;
  const last = tokens[tokens.length - 1]!;
  const a = (first[0] ?? '').toUpperCase();
  const b = (last[0] ?? '').toUpperCase();
  if (!a || !b) return '';
  return a + b;
}

function firstAndLast(name: string): { first: string; last: string } {
  const tokens = nameTokens(name ?? '').map((t) => normalizeForCompare(t));
  if (tokens.length < 2) return { first: '', last: '' };
  return { first: tokens[0]!, last: tokens[tokens.length - 1]! };
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]!;
  }
  return prev[n]!;
}

function metaphonesShare(a: [string, string], b: [string, string]): boolean {
  const [a1, a2] = a;
  const [b1, b2] = b;
  return Boolean(
    (a1 && (a1 === b1 || a1 === b2)) || (a2 && (a2 === b1 || a2 === b2)),
  );
}

function surnamesSimilar(typed: string, candidate: string, maxLev = 2): boolean {
  if (!typed || !candidate) return false;
  const a = normalizeForCompare(typed);
  const b = normalizeForCompare(candidate);
  if (!a || !b) return false;
  if (a === b) return true;
  if (levenshtein(a, b) <= maxLev) return true;
  return metaphonesShare(doubleMetaphone(a), doubleMetaphone(b));
}

// Strict local-entry match: full-name fuzzy OR (first exact + surname fuzzy).
// This is the fast-path. Cheap and conservative — false positives here would
// pin the wrong canonical name, so we'd rather miss locally and fall back to
// Wikipedia than over-match.
function localEntryMatches(typed: string, entry: string): boolean {
  const tNorm = normalizeForCompare(stripParens(typed));
  const eNorm = normalizeForCompare(stripParens(entry));
  if (!tNorm || !eNorm) return false;
  if (tNorm === eNorm) return true;
  if (levenshtein(tNorm, eNorm) <= 2) return true;

  const t = firstAndLast(typed);
  const e = firstAndLast(entry);
  if (!t.first || !e.first || !t.last || !e.last) return false;
  if (t.first === e.first && surnamesSimilar(t.last, e.last, 2)) return true;
  return false;
}

function isPrefixWithConnector(typed: string, candidate: string): boolean {
  const t = nameTokens(typed).map((s) => normalizeForCompare(s));
  const c = nameTokens(candidate).map((s) => normalizeForCompare(s));
  if (t.length === 0 || c.length <= t.length) return false;
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== c[i]) return false;
  }
  const rest = c[t.length];
  if (!rest) return false;
  return CONNECTOR_WORDS.has(rest);
}

// --- wikipedia / wikidata fetchers + caches -------------------------------

interface WikiSummary {
  title: string;
  description?: string;
  extract?: string;
  type?: string;
  content_urls?: { desktop?: { page?: string } };
  wikibase_item?: string;
}

interface WikidataEntity {
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: { id?: string } } } }>>;
}

const resultCache = new Map<string, ValidationResult>();
const summaryCache = new Map<string, WikiSummary | null>();
const openSearchCache = new Map<string, string[]>();
const wikidataCache = new Map<string, { human: boolean; fictional: boolean } | null>();
const linksCache = new Map<string, string[]>();

export function clearValidationCache(): void {
  resultCache.clear();
  summaryCache.clear();
  openSearchCache.clear();
  wikidataCache.clear();
  linksCache.clear();
}

async function getSummary(title: string): Promise<WikiSummary | null> {
  const key = title.toLowerCase();
  if (summaryCache.has(key)) return summaryCache.get(key) ?? null;
  let result: WikiSummary | null = null;
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) result = (await res.json()) as WikiSummary;
  } catch {
    result = null;
  }
  summaryCache.set(key, result);
  if (result?.title) summaryCache.set(result.title.toLowerCase(), result);
  return result;
}

async function getOpenSearch(query: string): Promise<string[]> {
  const key = query.toLowerCase();
  if (openSearchCache.has(key)) return openSearchCache.get(key)!;
  let titles: string[] = [];
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=10&format=json&origin=*`;
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as unknown;
      if (Array.isArray(data) && Array.isArray(data[1])) {
        titles = (data[1] as unknown[]).filter((t): t is string => typeof t === 'string');
      }
    }
  } catch {
    /* empty */
  }
  openSearchCache.set(key, titles);
  return titles;
}

async function getWikidata(qid: string): Promise<{ human: boolean; fictional: boolean } | null> {
  if (wikidataCache.has(qid)) return wikidataCache.get(qid) ?? null;
  let result: { human: boolean; fictional: boolean } | null = null;
  try {
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as { entities?: Record<string, WikidataEntity> };
      const entity = data.entities?.[qid];
      const claims = entity?.claims?.P31 ?? [];
      const ids = claims
        .map((c) => c.mainsnak?.datavalue?.value?.id)
        .filter((x): x is string => Boolean(x));
      result = {
        human: ids.includes('Q5'),
        fictional: ids.some((q) => FICTIONAL_QIDS.has(q)),
      };
    }
  } catch {
    /* empty */
  }
  wikidataCache.set(qid, result);
  return result;
}

// Parse a disambiguation page's wikitext to recover the curated candidate
// list. Wikipedia's bulleted entries (lines starting with "*") have the
// canonical article as the first wikilink, ordered by Wikipedia's editors
// in rough prominence order. The action=query prop=links endpoint does NOT
// preserve this ordering, so we read the raw wikitext.
async function getDisambigLinks(title: string): Promise<string[]> {
  const key = title.toLowerCase();
  if (linksCache.has(key)) return linksCache.get(key)!;
  const links: string[] = [];
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&titles=${encodeURIComponent(title)}&rvprop=content&rvslots=main&formatversion=2&format=json&origin=*&redirects=1`;
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as {
        query?: { pages?: Array<{ revisions?: Array<{ slots?: { main?: { content?: string } } }> }> };
      };
      const wt = data.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content ?? '';
      for (const line of wt.split('\n')) {
        if (!line.trim().startsWith('*')) continue;
        const m = line.match(/\[\[([^\]|#]+)/);
        if (m && m[1]) links.push(m[1].trim());
      }
    }
  } catch {
    /* empty */
  }
  linksCache.set(key, links);
  return links;
}

async function isPerson(summary: WikiSummary | null): Promise<boolean> {
  if (!summary) return false;
  if (summary.type === 'disambiguation') return false;
  const qid = summary.wikibase_item;
  if (qid) {
    const wd = await getWikidata(qid);
    if (wd) {
      if (wd.fictional) return false;
      return wd.human;
    }
  }
  // Fallback heuristic when Wikidata is unavailable.
  const extract = summary.extract ?? '';
  if (/\(born\s+\d{1,2}\s+\w+|\(born\s+\d{3,4}\)/i.test(extract)) return true;
  if (/\bborn\b\s+\d{1,2}\s+\w+\s+\d{3,4}/i.test(extract)) return true;
  if (/\(\d{3,4}\s*[–\-—]\s*(?:\d{3,4}|present)\)/i.test(extract)) return true;
  return false;
}

function asValid(summary: WikiSummary): ValidationResult {
  return {
    status: 'valid',
    canonicalName: summary.title,
    wikipediaUrl: summary.content_urls?.desktop?.page,
  };
}

// --- main -----------------------------------------------------------------

export async function validateName(name: string, opts: ValidateOptions = {}): Promise<ValidationResult> {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { status: 'invalid', reason: 'empty answer' };

  const cacheKey = `${trimmed.toLowerCase()}|${(opts.expectedInitials ?? '').toUpperCase()}`;
  const cached = resultCache.get(cacheKey);
  if (cached) return cached;

  const result = await _validate(trimmed, opts);
  resultCache.set(cacheKey, result);
  return result;
}

async function _validate(name: string, opts: ValidateOptions): Promise<ValidationResult> {
  // Hard gate: at least two name tokens.
  const tokens = nameTokens(name);
  if (tokens.length < 2) return { status: 'invalid', reason: 'need first and last name' };

  // Hard gate: typed initials must match the round's pair.
  const typedInitials = computeNameInitials(name);
  const expected = opts.expectedInitials?.toUpperCase();
  if (expected && typedInitials && typedInitials !== expected) {
    return { status: 'invalid', reason: `expected ${expected}, got ${typedInitials}` };
  }
  const targetInitials = expected ?? typedInitials;
  if (!targetInitials) return { status: 'invalid', reason: 'need first and last name' };

  // Track whether we encountered a real Wikipedia article that turned out
  // not to be a person (band, place, fictional character, concept). Used
  // to emit a more specific rejection message at the end.
  let sawNonPerson = false;

  // (a) Local fast-path.
  const localList = FAMOUS_PEOPLE[targetInitials] ?? [];
  for (const entry of localList) {
    if (localEntryMatches(name, entry.name)) {
      return { status: 'valid', canonicalName: entry.name, wikipediaUrl: entry.wikipediaUrl };
    }
  }

  // (b) Wikipedia exact-title.
  const exact = await getSummary(name);
  let exactWasDisambig = false;
  if (exact) {
    if (exact.type === 'disambiguation') {
      exactWasDisambig = true;
    } else if (computeNameInitials(exact.title) === targetInitials) {
      if (await isPerson(exact)) return asValid(exact);
      sawNonPerson = true;
    }
  }

  const hits = await getOpenSearch(name);

  // (c) Prefix-with-connector — "Queen Noor" → "Queen Noor of Jordan".
  // Runs before the general opensearch loop so a connector-suffixed canonical
  // title wins over a same-initials person whose name just happens to begin
  // the same way.
  for (const hitTitle of hits.slice(0, 3)) {
    if (!isPrefixWithConnector(name, hitTitle)) continue;
    const sum = await getSummary(hitTitle);
    if (!sum || sum.type === 'disambiguation') continue;
    if (await isPerson(sum)) return asValid(sum);
    sawNonPerson = true;
  }

  // (d) Disambig wikitext — if exact returned a disambiguation page, walk
  // its bulleted list (Wikipedia's curated prominence order) and accept the
  // first person whose initials match. This is what surfaces
  // "Chris Evans (actor)" instead of opensearch's "(presenter)".
  if (exactWasDisambig && exact) {
    const links = await getDisambigLinks(exact.title);
    let evaluated = 0;
    for (const linkTitle of links) {
      if (evaluated >= 25) break;
      if (computeNameInitials(linkTitle) !== targetInitials) continue;
      const sum = await getSummary(linkTitle);
      if (!sum || sum.type === 'disambiguation') continue;
      evaluated += 1;
      if (await isPerson(sum)) return asValid(sum);
      sawNonPerson = true;
    }
  }

  // (e) Opensearch — typo-tolerant suggestions ranked by Wikipedia. Catches
  // misspellings ("Harry Reasner" → "Harry Reasoner") and other cases the
  // earlier steps didn't reach.
  for (const hitTitle of hits.slice(0, 8)) {
    if (computeNameInitials(hitTitle) !== targetInitials) continue;
    const sum = await getSummary(hitTitle);
    if (!sum || sum.type === 'disambiguation') continue;
    if (await isPerson(sum)) return asValid(sum);
    sawNonPerson = true;
  }

  // (f) Reject. Distinguish "we found something but it isn't a real person"
  // (band, place, fictional character) from "we couldn't find anything".
  if (sawNonPerson) return { status: 'invalid', reason: 'not a real person' };
  return { status: 'invalid', reason: "couldn't verify" };
}
