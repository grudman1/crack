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
  /** Optional sink that captures per-stage telemetry for the debug page.
   *  In production (no collector passed), there is zero overhead — the
   *  validator never builds the records. */
  trace?: TraceCollector;
  /** When true, skip in-process caches so every call hits the live API.
   *  Used by the debug page to surface current Wikipedia behavior. */
  bypassCache?: boolean;
}

/** A single record emitted by the validator into a trace collector. One
 *  record per logical step (a hard gate, a chain stage, or a sub-check
 *  inside a stage). Stages emit at least one record describing how they
 *  decided. */
export interface TraceRecord {
  stage:
    | 'gate'
    | 'local'
    | 'exact'
    | 'prefix-connector'
    | 'disambig'
    | 'opensearch'
    | '1tok-redirect'
    | 'final';
  /** Human-readable label for the stage (e.g. "Local fast-path"). */
  label: string;
  /** "hit" = matched and accepted, "miss" = checked but didn't match,
   *  "skip" = stage didn't run, "info" = neutral observation. */
  outcome: 'hit' | 'miss' | 'skip' | 'info';
  /** One-line summary of what happened. */
  note: string;
  /** Optional structured details (URLs fetched, candidate titles, etc.) */
  detail?: Record<string, unknown>;
}

export type TraceCollector = (r: TraceRecord) => void;

const SUFFIXES = new Set(['JR', 'SR', 'I', 'II', 'III', 'IV', 'V', 'PHD', 'MD', 'ESQ']);
// Leading honorifics stripped from typed input before computing initials.
// Stored uppercase; matched case-insensitively and with an optional trailing
// period ("Dr" / "Dr."). Stripped at the gate only — never inside
// nameTokens, so both raw and stripped variants stay visible for diagnostics.
const HONORIFICS = new Set([
  'SIR', 'DAME',
  'DR', 'MR', 'MRS', 'MS', 'MX',
  'PROF', 'HON', 'REV', 'FR',
  'SISTER', 'BROTHER',
  'CAPT', 'COL', 'GEN', 'LT', 'SGT',
]);
// Post-comma noble/regnal suffix attached to canonical Wikipedia titles
// (e.g. "Prince Harry, Duke of Sussex" → strip ", Duke of Sussex"). Only
// strips when the suffix is comma-delimited; "Sir Henry Tate" stays as-is.
const CANONICAL_NOBLE_SUFFIX_RE =
  /,\s*(?:Duke|Duchess|Earl|Countess|Baron|Baroness|Viscount|Viscountess|Lord|Lady|Marquess|Marchioness|Prince|Princess|King|Queen|Pope|Saint|Sir|Dame)\s+of\s+.+$/i;
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

// Strip up to two leading honorifics from a typed name. "Dr" / "Dr." both
// match. Returns the original string if no honorific is present.
function stripLeadingHonorific(name: string): string {
  let cur = (name ?? '').trim();
  for (let i = 0; i < 2; i++) {
    const m = cur.match(/^([A-Za-z]+)\.?\s+(.+)$/);
    if (!m) return cur;
    if (!HONORIFICS.has(m[1]!.toUpperCase())) return cur;
    cur = m[2]!.trim();
  }
  return cur;
}

function stripCanonicalNobleSuffix(title: string): string {
  return (title ?? '').replace(CANONICAL_NOBLE_SUFFIX_RE, '').trim();
}

/** Both plausible initials for a typed name: raw, plus the variant with a
 *  leading honorific stripped (when different). Used by the hard gate so
 *  "Dame Judi Dench" accepts as JD and "Judi Dench" as JD. */
function typedInitialsCandidates(name: string): string[] {
  const raw = computeNameInitials(name);
  const stripped = computeNameInitials(stripLeadingHonorific(name));
  const out: string[] = [];
  if (raw) out.push(raw);
  if (stripped && stripped !== raw) out.push(stripped);
  return out;
}

/** Both plausible initials for a Wikipedia canonical title: raw, plus the
 *  variant with a post-comma noble suffix stripped (when different). Used
 *  by every chain stage so "Prince Harry, Duke of Sussex" surfaces PH as
 *  well as PS. Exported for diagnostic tooling. */
export function canonicalInitialsCandidates(title: string): string[] {
  const raw = computeNameInitials(title);
  const stripped = computeNameInitials(stripCanonicalNobleSuffix(title));
  const out: string[] = [];
  if (raw) out.push(raw);
  if (stripped && stripped !== raw) out.push(stripped);
  return out;
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

// Build the set of plausible canonical-side surnames for a Wikipedia
// title. Used by the chain stages that match opensearch / disambig /
// prefix-connector candidates so a typed surname can be validated
// against the right slot, not the literal last token of a noble or
// prefix-style title.
//
//   "Prince Harry, Duke of Sussex" → [Sussex, Harry]   (noble strip)
//   "Queen Noor of Jordan"         → [Jordan, Noor]    ("of" strip)
//   "Robert De Niro"                → [Niro]            (no strips)
//
// We only strip " of <X>" — wider connectors (van/von/de/etc.) are
// frequent legitimate name particles, so widening risks false positives.
function canonicalSurnameCandidates(title: string): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    const last = firstAndLast(s).last;
    if (last) out.push(last);
  };
  add(title);
  const nobleStripped = stripCanonicalNobleSuffix(title);
  if (nobleStripped !== title) add(nobleStripped);
  const ofStripped = title.replace(/\s+of\s+.+$/i, '');
  if (ofStripped !== title) add(ofStripped);
  return Array.from(new Set(out));
}

/** Whether the typed name's surname is plausibly the same as the
 *  canonical's. Lev ≤ 2 OR phonetic match (matches the local fast-path
 *  threshold). When the typed input has fewer than 2 tokens we can't
 *  constrain — return true so the caller doesn't double-gate.
 */
function surnameMatchesCanonical(typed: string, canonical: string): boolean {
  const typedLast = firstAndLast(typed).last;
  if (!typedLast) return true;
  for (const cLast of canonicalSurnameCandidates(canonical)) {
    if (surnamesSimilar(typedLast, cLast, 2)) return true;
  }
  return false;
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

// Per-word length-ratio gate. Each typed token's length must be at least
// 70% of the candidate's same-position token. This blocks stub matches
// like "Teddy Ro" → "Teddy Robin" (surname ratio 2/5 = 40%) while
// allowing typos of comparable length ("Roosvelt" → "Roosevelt" = 89%).
const LENGTH_RATIO_THRESHOLD = 0.7;

/** Returns the *minimum* per-token length ratio (typed / candidate)
 *  along with whether that minimum clears LENGTH_RATIO_THRESHOLD.
 *  The opensearch iterate trace reports the value so admins can see
 *  exactly how close a borderline candidate was. */
function wordLengthRatioDetail(typed: string, candidate: string): { value: number; pass: boolean } {
  const t = nameTokens(typed).map((s) => normalizeForCompare(s)).filter(Boolean);
  const c = nameTokens(candidate).map((s) => normalizeForCompare(s)).filter(Boolean);
  if (t.length === 0 || c.length === 0) return { value: 0, pass: false };
  const n = Math.min(t.length, c.length);
  let minRatio = Infinity;
  for (let i = 0; i < n; i++) {
    const tl = t[i]!.length;
    const cl = c[i]!.length;
    if (cl === 0) return { value: 0, pass: false };
    const r = tl / cl;
    if (r < minRatio) minRatio = r;
  }
  if (!isFinite(minRatio)) return { value: 0, pass: false };
  return {
    value: Math.round(minRatio * 100) / 100,
    pass: minRatio >= LENGTH_RATIO_THRESHOLD,
  };
}

function wordLengthRatioOK(typed: string, candidate: string): boolean {
  return wordLengthRatioDetail(typed, candidate).pass;
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

// Wikidata + Wikipedia REST APIs reject requests from Node without a
// User-Agent header (HTTP 429). Browsers can't override User-Agent (it's
// a forbidden request header per Fetch spec), so we only inject one when
// running outside the browser — i.e. from the regression runner. In
// production this branch is dead and fetch() runs with the browser's UA.
function makeHeaders(base: Record<string, string> = {}): Record<string, string> {
  if (typeof window !== 'undefined') return base;
  return {
    ...base,
    'User-Agent': 'crack-validator/1.0 (https://crack-black.vercel.app)',
  };
}

async function getSummary(title: string): Promise<WikiSummary | null> {
  const key = title.toLowerCase();
  if (summaryCache.has(key)) return summaryCache.get(key) ?? null;
  let result: WikiSummary | null = null;
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers: makeHeaders({ Accept: 'application/json' }) });
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
    const res = await fetch(url, { headers: makeHeaders() });
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
    // QIDs are always /^Q\d+$/ in practice but encodeURIComponent
    // is cheap and gives us defense in depth.
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`;
    const res = await fetch(url, { headers: makeHeaders() });
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
    const res = await fetch(url, { headers: makeHeaders() });
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
  // Fallback heuristics for when Wikidata is unavailable or missing P31.
  const extract = summary.extract ?? '';
  if (/\(born\s+\d{1,2}\s+\w+|\(born\s+\d{3,4}\)/i.test(extract)) return true;
  if (/\bborn\b\s+\d{1,2}\s+\w+\s+\d{3,4}/i.test(extract)) return true;
  if (/\(\d{3,4}\s*[–\-—]\s*(?:\d{3,4}|present)\)/i.test(extract)) return true;
  // Wikipedia biography opener: "<Name> (…) was/is/were a/an/the <profession>"
  // The first sentence of a biographical article almost always uses this form.
  const firstSentence = extract.split(/\.\s/, 1)[0] ?? '';
  if (/\b(?:is|was|were)\s+(?:an?|the)\s+[A-Z]?[a-z]/i.test(firstSentence)) return true;
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
  const trace = opts.trace;
  if (!trimmed) {
    trace?.({ stage: 'gate', label: 'Input', outcome: 'miss', note: 'empty input' });
    trace?.({ stage: 'final', label: 'Reject', outcome: 'info', note: 'empty answer' });
    return { status: 'invalid', reason: 'empty answer' };
  }

  const cacheKey = `${trimmed.toLowerCase()}|${(opts.expectedInitials ?? '').toUpperCase()}`;
  if (!opts.bypassCache) {
    const cached = resultCache.get(cacheKey);
    if (cached) {
      trace?.({ stage: 'final', label: 'Cached', outcome: 'info', note: `served from in-memory cache: ${cached.status}` });
      return cached;
    }
  }

  const result = await _validate(trimmed, opts);
  resultCache.set(cacheKey, result);
  return result;
}

async function _validate(name: string, opts: ValidateOptions): Promise<ValidationResult> {
  const trace = opts.trace;
  const tokens = nameTokens(name);
  const expected = opts.expectedInitials?.toUpperCase();

  // Single-token input.
  if (tokens.length < 2) {
    if (name.length >= 3 && expected) {
      trace?.({
        stage: '1tok-redirect',
        label: '1-token abbreviation → Wikipedia redirect',
        outcome: 'info',
        note: `trying GET /page/summary/${encodeURIComponent(name)}`,
        detail: { url: `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}` },
      });
      const exact = await getSummary(name);
      const exactCands = exact ? canonicalInitialsCandidates(exact.title) : [];
      if (
        exact &&
        exact.type === 'standard' &&
        exact.title.toLowerCase() !== name.toLowerCase() &&
        exactCands.includes(expected) &&
        (await isPerson(exact))
      ) {
        trace?.({
          stage: '1tok-redirect',
          label: '1-token redirect',
          outcome: 'hit',
          note: `redirected to "${exact.title}" (initials ${exactCands.join('/')}) — person`,
          detail: { canonicalTitle: exact.title },
        });
        trace?.({ stage: 'final', label: 'Accept', outcome: 'info', note: `canonical: ${exact.title}` });
        return asValid(exact);
      }
      trace?.({
        stage: '1tok-redirect',
        label: '1-token redirect',
        outcome: 'miss',
        note: exact
          ? `got "${exact.title}" (type=${exact.type}, initials=${exactCands.join('/') || '—'}) — does not match expected ${expected}`
          : 'no Wikipedia article',
      });
    } else {
      trace?.({
        stage: 'gate',
        label: 'Token count',
        outcome: 'miss',
        note: `single token, length ${name.length} < 3 (not an abbreviation)`,
      });
    }
    trace?.({ stage: 'final', label: 'Reject', outcome: 'info', note: 'need first and last name' });
    return { status: 'invalid', reason: 'need first and last name' };
  }

  // Hard gate: typed initials must match the round's pair. We accept
  // either the raw initials OR the honorific-stripped variant (so
  // "Dame Judi Dench" / "Judi Dench" both pass for JD). When the strip
  // is the variant that matches, rebind `name` to the stripped form so
  // every subsequent stage queries Wikipedia for the cleaner name.
  const rawInitials = computeNameInitials(name);
  const honorificStripped = stripLeadingHonorific(name);
  const wasStripped = honorificStripped !== name;
  const strippedInitials = wasStripped ? computeNameInitials(honorificStripped) : '';
  const candidates = typedInitialsCandidates(name);
  if (expected && candidates.length > 0 && !candidates.includes(expected)) {
    const got = candidates.join(' / ');
    trace?.({
      stage: 'gate',
      label: 'Initials',
      outcome: 'miss',
      note: `expected ${expected}, got ${got}`,
    });
    trace?.({ stage: 'final', label: 'Reject', outcome: 'info', note: `expected ${expected}, got ${got}` });
    return { status: 'invalid', reason: `expected ${expected}, got ${got}` };
  }
  const targetInitials = expected ?? rawInitials;
  if (!targetInitials) {
    trace?.({ stage: 'gate', label: 'Initials', outcome: 'miss', note: 'could not derive initials' });
    trace?.({ stage: 'final', label: 'Reject', outcome: 'info', note: 'need first and last name' });
    return { status: 'invalid', reason: 'need first and last name' };
  }
  // Decide which variant of the typed name to carry into downstream stages.
  const stripDecisive = Boolean(expected) && rawInitials !== expected && strippedInitials === expected;
  if (stripDecisive) {
    const stripped = name.slice(0, name.length - honorificStripped.length).trim();
    trace?.({
      stage: 'gate',
      label: 'Initials',
      outcome: 'hit',
      note: `typed initials ${strippedInitials} match expected ${targetInitials} (after stripping leading honorific "${stripped}")`,
    });
    name = honorificStripped;
  } else {
    trace?.({
      stage: 'gate',
      label: 'Initials',
      outcome: 'hit',
      note: `typed initials ${rawInitials || '(derived)'} match expected ${targetInitials}`,
    });
  }

  // (a) Local fast-path.
  const localList = FAMOUS_PEOPLE[targetInitials] ?? [];
  for (const entry of localList) {
    if (!localEntryMatches(name, entry.name)) continue;
    if (!wordLengthRatioOK(name, entry.name)) {
      trace?.({
        stage: 'local',
        label: 'Local fast-path',
        outcome: 'miss',
        note: `name-similar to "${entry.name}" but length ratio < 0.7`,
      });
      continue;
    }
    trace?.({
      stage: 'local',
      label: 'Local fast-path',
      outcome: 'hit',
      note: `matched FAMOUS_PEOPLE[${targetInitials}] entry "${entry.name}"`,
      detail: { canonical: entry.name, pool: localList.length },
    });
    trace?.({ stage: 'final', label: 'Accept', outcome: 'info', note: `canonical: ${entry.name}` });
    return { status: 'valid', canonicalName: entry.name, wikipediaUrl: entry.wikipediaUrl };
  }
  trace?.({
    stage: 'local',
    label: 'Local fast-path',
    outcome: 'miss',
    note: `no match in FAMOUS_PEOPLE[${targetInitials}] (${localList.length} entries)`,
    detail: { pool: localList.length },
  });

  // (b) Wikipedia exact-title.
  trace?.({
    stage: 'exact',
    label: 'Wikipedia exact-title',
    outcome: 'info',
    // Show the encoded URL in the human-readable note so the trace
    // matches what actually hits the wire — readers shouldn't
    // confuse the display label with the request URL.
    note: `GET /page/summary/${encodeURIComponent(name)}`,
    detail: { url: `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}` },
  });
  const exact = await getSummary(name);
  let exactWasDisambig = false;
  if (exact) {
    if (exact.type === 'disambiguation') {
      exactWasDisambig = true;
      trace?.({
        stage: 'exact',
        label: 'Wikipedia exact-title',
        outcome: 'miss',
        note: `"${exact.title}" is a disambiguation page — flagged for stage (d)`,
      });
    } else {
      const titleCands = canonicalInitialsCandidates(exact.title);
      const titleInitialsLabel = titleCands.join('/') || '—';
      const initialsOK = titleCands.includes(targetInitials);
      const ratioOK = wordLengthRatioOK(name, exact.title);
      const personChecked = initialsOK && ratioOK;
      const person = personChecked ? await isPerson(exact) : false;
      if (initialsOK && ratioOK && person) {
        trace?.({
          stage: 'exact',
          label: 'Wikipedia exact-title',
          outcome: 'hit',
          note: `"${exact.title}" — initials ${titleInitialsLabel} ✓, length ratio ✓, person ✓`,
          detail: { canonical: exact.title, wikibase_item: exact.wikibase_item },
        });
        trace?.({ stage: 'final', label: 'Accept', outcome: 'info', note: `canonical: ${exact.title}` });
        return asValid(exact);
      }
      const personLabel = personChecked ? (person ? '✓' : '✗') : 'skipped';
      trace?.({
        stage: 'exact',
        label: 'Wikipedia exact-title',
        outcome: 'miss',
        note: `"${exact.title}" — initials ${titleInitialsLabel} ${initialsOK ? '✓' : '✗'}, ratio ${ratioOK ? '✓' : '✗'}, person ${personLabel}`,
        detail: { canonical: exact.title, initials: titleInitialsLabel },
      });
    }
  } else {
    trace?.({
      stage: 'exact',
      label: 'Wikipedia exact-title',
      outcome: 'miss',
      note: '404 — no article at that title',
    });
  }

  const hits = await getOpenSearch(name);
  trace?.({
    stage: 'opensearch',
    label: 'Opensearch (typo-tolerant)',
    outcome: 'info',
    note: `${hits.length} hits: ${hits.slice(0, 5).map((h) => `"${h}"`).join(', ')}${hits.length > 5 ? '…' : ''}`,
    detail: { hits },
  });

  // (c) Prefix-with-connector.
  for (const hitTitle of hits.slice(0, 3)) {
    if (!isPrefixWithConnector(name, hitTitle)) continue;
    if (!wordLengthRatioOK(name, hitTitle)) continue;
    // The prefix structure guarantees the typed surname appears as a
    // token in the canonical, but it doesn't guarantee the typed
    // surname is the right slot. surnameMatchesCanonical compares
    // against both the raw last token AND the "<X> of Y"-stripped
    // last token, so "Queen Noor" → "Queen Noor of Jordan" still
    // matches (Noor passes against the stripped prefix surname) while
    // an unrelated prefix collision would fail.
    if (!surnameMatchesCanonical(name, hitTitle)) {
      const typedLast = firstAndLast(name).last;
      const canonLast = firstAndLast(hitTitle).last;
      trace?.({
        stage: 'prefix-connector',
        label: 'Prefix-with-connector',
        outcome: 'miss',
        note: `"${hitTitle}" — prefix ✓, ratio ✓, but surname '${typedLast}' not similar to '${canonLast}'`,
      });
      continue;
    }
    const sum = await getSummary(hitTitle);
    if (!sum || sum.type === 'disambiguation') {
      trace?.({
        stage: 'prefix-connector',
        label: 'Prefix-with-connector',
        outcome: 'miss',
        note: `"${hitTitle}" — disambig or no summary`,
      });
      continue;
    }
    if (await isPerson(sum)) {
      trace?.({
        stage: 'prefix-connector',
        label: 'Prefix-with-connector',
        outcome: 'hit',
        note: `typed prefix matches "${hitTitle}" with connector — person ✓`,
        detail: { canonical: sum.title },
      });
      trace?.({ stage: 'final', label: 'Accept', outcome: 'info', note: `canonical: ${sum.title}` });
      return asValid(sum);
    }
    trace?.({
      stage: 'prefix-connector',
      label: 'Prefix-with-connector',
      outcome: 'miss',
      note: `"${hitTitle}" — not a person`,
    });
  }

  // (d) Disambig wikitext.
  if (exactWasDisambig && exact) {
    const links = await getDisambigLinks(exact.title);
    let evaluated = 0;
    for (const linkTitle of links) {
      if (evaluated >= 25) break;
      if (!canonicalInitialsCandidates(linkTitle).includes(targetInitials)) continue;
      if (!wordLengthRatioOK(name, linkTitle)) continue;
      // Disambig links share initials by construction, so the surname
      // gate is the main way to reject "Chris Evans" → wrong-Chris-Evans
      // style collisions. Failure is silent here (no per-link trace) —
      // the loop already emits a summary miss when nothing matched.
      if (!surnameMatchesCanonical(name, linkTitle)) continue;
      const sum = await getSummary(linkTitle);
      if (!sum || sum.type === 'disambiguation') continue;
      evaluated += 1;
      if (await isPerson(sum)) {
        trace?.({
          stage: 'disambig',
          label: 'Disambig wikitext',
          outcome: 'hit',
          note: `picked "${sum.title}" (link #${evaluated} with matching initials, is a person)`,
          detail: { canonical: sum.title, linksScanned: links.length },
        });
        trace?.({ stage: 'final', label: 'Accept', outcome: 'info', note: `canonical: ${sum.title}` });
        return asValid(sum);
      }
    }
    trace?.({
      stage: 'disambig',
      label: 'Disambig wikitext',
      outcome: 'miss',
      note: `iterated ${links.length} links from "${exact.title}", evaluated ${evaluated} initials-matching candidates, none were a person`,
    });
  } else {
    trace?.({
      stage: 'disambig',
      label: 'Disambig wikitext',
      outcome: 'skip',
      note: 'exact lookup did not return a disambig page',
    });
  }

  // (e) Opensearch iteration.
  //
  // The original implementation emitted at most one trace record
  // per iteration (and only on certain failure modes), then one
  // generic summary at the end ("none of the top-N matched"). That
  // hides where each candidate actually died. The rewrite emits one
  // structured record per hit so the diagnostic helper — and a human
  // reading the trace — can see exactly which check rejected each
  // candidate, plus whether we got a wikibase_item from Wikipedia.
  //
  // The chain logic is identical (same checks, same order, same
  // early-exit). Only the trace shape changed.
  const rejectionCounts: Record<'initials' | 'ratio' | 'surname' | 'person', number> = {
    initials: 0,
    ratio: 0,
    surname: 0,
    person: 0,
  };
  const iteratedTitles = hits.slice(0, 8);

  for (const hitTitle of iteratedTitles) {
    const titleCands = canonicalInitialsCandidates(hitTitle);
    const initialsOK = titleCands.includes(targetInitials);

    let ratioInfo: { value: number; pass: boolean } | null = null;
    let surnameOK: 'pass' | 'fail' | 'unknown' = 'unknown';
    let personOK: 'pass' | 'fail' | 'unknown' = 'unknown';
    let qid: string | undefined;
    let sum: WikiSummary | null = null;
    let rejectedBy: 'initials' | 'ratio' | 'surname' | 'person' | null = null;

    if (!initialsOK) {
      rejectedBy = 'initials';
    } else {
      ratioInfo = wordLengthRatioDetail(name, hitTitle);
      if (!ratioInfo.pass) {
        rejectedBy = 'ratio';
      } else {
        surnameOK = surnameMatchesCanonical(name, hitTitle) ? 'pass' : 'fail';
        if (surnameOK === 'fail') {
          rejectedBy = 'surname';
        } else {
          sum = await getSummary(hitTitle);
          qid = sum?.wikibase_item;
          if (!sum || sum.type === 'disambiguation') {
            // No summary to person-check → can't verify → reject.
            rejectedBy = 'person';
          } else {
            personOK = (await isPerson(sum)) ? 'pass' : 'fail';
            if (personOK !== 'pass') rejectedBy = 'person';
          }
        }
      }
    }

    const detail: Record<string, unknown> = {
      canonicalTitle: hitTitle,
      canonicalInitials: titleCands.join('/') || '—',
      expectedPair: targetInitials,
      checks: {
        initials: initialsOK ? 'pass' : 'fail',
        ratio: ratioInfo,
        surname: surnameOK,
        person: personOK,
      },
      rejectedBy,
    };
    if (qid) detail.qid = qid;

    if (rejectedBy === null && personOK === 'pass' && sum) {
      trace?.({
        stage: 'opensearch',
        label: `iterate: ${hitTitle}`,
        outcome: 'hit',
        note: `"${hitTitle}" — initials ✓, ratio ✓, surname ✓, person ✓`,
        detail,
      });
      trace?.({ stage: 'final', label: 'Accept', outcome: 'info', note: `canonical: ${sum.title}` });
      return asValid(sum);
    }

    if (rejectedBy) rejectionCounts[rejectedBy] += 1;

    const typedLast = firstAndLast(name).last;
    const canonLast = firstAndLast(hitTitle).last;
    let note: string;
    if (rejectedBy === 'initials') {
      note = `"${hitTitle}" — initials ${detail.canonicalInitials} ≠ ${targetInitials}`;
    } else if (rejectedBy === 'ratio') {
      note = `"${hitTitle}" — initials ✓, ratio ${ratioInfo!.value} < ${LENGTH_RATIO_THRESHOLD}`;
    } else if (rejectedBy === 'surname') {
      note = `"${hitTitle}" — initials ✓, ratio ✓, surname '${typedLast}' ≁ '${canonLast}'`;
    } else if (rejectedBy === 'person') {
      const qidLabel = qid ? `qid ${qid}` : 'no qid';
      const personLabel = personOK === 'fail' ? 'not a person' : 'no summary';
      note = `"${hitTitle}" — initials ✓, ratio ✓, surname ✓, ${personLabel} (${qidLabel})`;
    } else {
      note = `"${hitTitle}" — unknown rejection`;
    }
    trace?.({
      stage: 'opensearch',
      label: `iterate: ${hitTitle}`,
      outcome: 'miss',
      note,
      detail,
    });
  }

  // Summary tally — keep the at-a-glance line so a quick read of
  // the trace still tells the high-level story.
  const tallyParts: string[] = [];
  for (const [k, n] of Object.entries(rejectionCounts)) {
    if (n > 0) tallyParts.push(`${k}: ${n}`);
  }
  trace?.({
    stage: 'opensearch',
    label: 'Opensearch iterate',
    outcome: 'miss',
    note: `${iteratedTitles.length} hit${iteratedTitles.length === 1 ? '' : 's'}, all rejected${tallyParts.length ? ` (${tallyParts.join(', ')})` : ''}.`,
    detail: { rejectionCounts, iterated: iteratedTitles.length },
  });
  trace?.({ stage: 'final', label: 'Reject', outcome: 'info', note: "couldn't verify" });
  return { status: 'invalid', reason: "couldn't verify" };
}
