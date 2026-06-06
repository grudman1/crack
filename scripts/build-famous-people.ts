// Rebuild src/data/famousPeople.ts as a top-N-per-pair fame ranking,
// not a notability threshold. For every initial pair AA…ZZ the entries
// are the most-recognized people on Earth with those initials.
//
// Methodology:
//   score = 0.65 * normalize(log(pageviews + 1))
//         + 0.35 * normalize(log(langlinks + 1))
//
// The user spec called for a three-signal blend with Pantheon HPI as
// the third leg, but Pantheon's data downloads sit behind a Next.js
// SPA with no clean direct URL and the public Wikidata SPARQL endpoint
// times out (60s) for the "all humans with N+ sitelinks" query I'd
// need to ingest them by QID. The two signals we DO have left are
// strong enough that Einstein-tier entries score in the top decile —
// langlinks captures encyclopedic fame (Einstein 270+, vs Zach Bryan
// ~25), pageviews captures contemporary recognition. Documented in
// the log; future passes can layer HPI on top.
//
// Candidate pool:
//   1. Wikipedia's top-1000-most-viewed-articles for each of the last
//      12 months (12 cheap REST calls). Filter to humans via the
//      Wikidata P31=Q5 check. Captures modern celebrities — Taylor
//      Swift, Zach Bryan, Pedro Pascal — that the prior Pantheon-only
//      build missed entirely.
//   2. The existing famousPeople.ts entries — already curated, want
//      to preserve work like the explicit slugs for Pope Benedict XVI
//      and the Pattern-C placements for A. J. Foyt / J. K. Rowling.
//
// Caching: every Wikipedia summary / pageviews / Wikidata lookup is
// keyed by slug or QID and written under scripts/data/cache/. Re-runs
// with the same data are fast; --refresh-pageviews or --refresh-all
// blow specific caches away.
//
// Usage:
//   npm run build:famous                       # full rebuild from cache
//   npm run build:famous -- --refresh-top      # refetch top-monthly
//   npm run build:famous -- --refresh-pageviews
//   npm run build:famous -- --refresh-all
//   npm run build:famous -- --pair=TS          # rebuild only TS

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';

// ---------------------------------------------------------------------------
// Constants & paths

const ROOT = path.resolve(import.meta.dirname, '..');
const TARGET = path.join(ROOT, 'src/data/famousPeople.ts');
const LOG_PATH = path.join(ROOT, 'scripts/build-famous-people.log.md');
const CACHE_DIR = path.join(ROOT, 'scripts/data/cache');
const TOP_CACHE = path.join(CACHE_DIR, 'top-monthly');
const SUMMARY_CACHE = path.join(CACHE_DIR, 'summary');
const WIKIDATA_CACHE = path.join(CACHE_DIR, 'wikidata');
const PAGEVIEWS_CACHE = path.join(CACHE_DIR, 'pageviews');

const TOP_N_PER_PAIR = 8;
const TOP_K_FOR_PAGEVIEWS = 40; // per-pair, candidates kept for pageviews fetch

const WEIGHTS = {
  pageviews: 0.65,
  sitelinks: 0.35,
};

const USER_AGENT =
  'crack-build-famous-people/1.0 (https://github.com/grudman1/crack) contact:curator@example.com';

// ---------------------------------------------------------------------------
// Types

interface SourceEntry {
  /** Display name shown to the player. */
  name: string;
  /** Wikipedia URL slug (underscores). */
  slug: string;
  /** Pre-curated description (from the existing famousPeople.ts).
   *  Re-emitted as-is if present and non-empty. */
  description?: string;
  /** Bucket the existing dataset filed this entry under. Preserved on
   *  re-emit so Pattern-C entries (A. J. Foyt in AJ, J. K. Rowling in
   *  JK) stay where the player expects them. */
  originalBucket?: string;
  /** Provenance — for the log + smell-test. */
  source: 'existing' | 'top-monthly';
}

interface ScoredCandidate extends SourceEntry {
  bucket: string;
  qid?: string;
  isHuman?: boolean;
  isFictional?: boolean;
  pageviews: number;
  sitelinks: number;
  score: number;
  pvNorm: number;
  slNorm: number;
}

interface CliFlags {
  refreshTop: boolean;
  refreshPageviews: boolean;
  refreshAll: boolean;
  pair?: string;
  dryRun: boolean;
}

// ---------------------------------------------------------------------------
// CLI

function parseArgs(argv: string[]): CliFlags {
  const f: CliFlags = { refreshTop: false, refreshPageviews: false, refreshAll: false, dryRun: false };
  for (const a of argv) {
    if (a === '--refresh-top') f.refreshTop = true;
    else if (a === '--refresh-pageviews') f.refreshPageviews = true;
    else if (a === '--refresh-all') {
      f.refreshAll = true;
      f.refreshTop = true;
      f.refreshPageviews = true;
    } else if (a === '--dry-run') f.dryRun = true;
    else if (a.startsWith('--pair=')) f.pair = a.slice('--pair='.length).toUpperCase();
  }
  return f;
}

// ---------------------------------------------------------------------------
// FS helpers

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}
function safeReadJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
  } catch {
    return null;
  }
}
function writeJson(p: string, data: unknown): void {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(data));
}
function slugify(name: string): string {
  return name.replace(/ /g, '_');
}
function safeSlugKey(slug: string): string {
  // Filesystem-safe key — encodeURIComponent for path safety.
  return encodeURIComponent(slug);
}

// ---------------------------------------------------------------------------
// HTTP helpers

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, attempts = 5): Promise<Response | null> {
  let backoff = 500;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT },
      });
      if (r.status === 429 || r.status >= 500) {
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 8000);
        continue;
      }
      return r;
    } catch {
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 8000);
    }
  }
  return null;
}

async function pmap<T, R>(items: T[], concurrency: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return out;
}

// ---------------------------------------------------------------------------
// Parser for the existing famousPeople.ts (kept minimal — same approach as
// curate-famous-people.ts). The file shape is locked: one pair per line,
// `p('name', 'description'[, 'slug'])`.

const SQ_STR = "'((?:\\\\.|[^'\\\\])*)'";
const P_CALL = new RegExp(`p\\(\\s*${SQ_STR}\\s*,\\s*${SQ_STR}(?:\\s*,\\s*${SQ_STR})?\\s*\\)`, 'g');
function unescapeSq(s: string): string { return s.replace(/\\(.)/g, '$1'); }
function emitSq(s: string): string {
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

interface ParsedFile {
  header: string;
  footer: string;
  entries: { bucket: string; name: string; description: string; slug?: string }[];
}

function parseExisting(text: string): ParsedFile {
  const openMarker = 'export const FAMOUS_PEOPLE: Record<string, Suggestion[]> = {';
  const openIdx = text.indexOf(openMarker);
  if (openIdx < 0) throw new Error('opener not found');
  const bodyStart = openIdx + openMarker.length;
  const closeIdx = text.lastIndexOf('};');
  const header = text.slice(0, bodyStart);
  const footer = text.slice(closeIdx);
  const body = text.slice(bodyStart, closeIdx);
  const entries: ParsedFile['entries'] = [];
  for (const raw of body.split('\n')) {
    const m = raw.match(/^\s*([A-Z]{2})\s*:\s*\[(.*)\],?\s*$/);
    if (!m) continue;
    const bucket = m[1]!;
    const inner = m[2]!;
    let cm: RegExpExecArray | null;
    P_CALL.lastIndex = 0;
    while ((cm = P_CALL.exec(inner)) !== null) {
      entries.push({
        bucket,
        name: unescapeSq(cm[1]!),
        description: unescapeSq(cm[2]!),
        slug: cm[3] != null ? unescapeSq(cm[3]) : undefined,
      });
    }
  }
  return { header, footer, entries };
}

// ---------------------------------------------------------------------------
// Initials — same approach as curate-famous-people.ts. Raw player-mental
// initials, no SUFFIXES stripping (so "Harald V" → HV).

function rawTokens(name: string): string[] {
  return name.replace(/\([^)]*\)/g, '').trim().split(/\s+/).filter(Boolean);
}
function playerInitials(name: string): string {
  const t = rawTokens(name);
  if (t.length < 2) return '';
  // Strip leading and trailing non-letter punctuation so a name like
  // `"Weird Al" Yankovic` produces "WY", not `"Y` (the literal first
  // character of the first token was a double-quote in the v1 output).
  // The leading-strip is the important fix; trailing-strip preserves
  // the prior `.,;`-tail behavior for "A. J." style names.
  const stripLead = (s: string): string => s.replace(/^[^A-Za-zÀ-￿]+/, '');
  const stripTail = (s: string): string => s.replace(/[.,;"]+$/, '');
  const first = stripLead(stripTail(t[0]!));
  const last = stripLead(stripTail(t[t.length - 1]!));
  if (!first || !last) return '';
  // ASCII-fold the initial so accented names ("Álex Palou") land in the
  // ASCII bucket (AP) instead of a separate "ÁP" bucket no player
  // would think to look for.
  const fold = (c: string): string => c.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return (fold(first[0] ?? '')).toUpperCase() + (fold(last[0] ?? '')).toUpperCase();
}

// ---------------------------------------------------------------------------
// Step 1 — top-monthly Wikipedia articles for the trailing 12 months.

interface TopArticle {
  article: string;
  views: number;
  rank: number;
}
interface TopMonth {
  yyyymm: string;
  articles: TopArticle[];
}

function trailingMonths(n: number): { yyyy: string; mm: string }[] {
  // Trailing N months ending with the most recently complete month.
  // For May 2026 with today = the 17th, the last complete month is Apr 2026.
  const today = new Date();
  const out: { yyyy: string; mm: string }[] = [];
  // Start from previous month (mm-1).
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    out.push({
      yyyy: String(d.getUTCFullYear()),
      mm: String(d.getUTCMonth() + 1).padStart(2, '0'),
    });
  }
  return out;
}

async function fetchTopMonth(yyyy: string, mm: string, refresh: boolean): Promise<TopMonth | null> {
  const file = path.join(TOP_CACHE, `${yyyy}-${mm}.json`);
  if (!refresh) {
    const cached = safeReadJson<TopMonth>(file);
    if (cached) return cached;
  }
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${yyyy}/${mm}/all-days`;
  const r = await fetchWithRetry(url);
  if (!r || !r.ok) return null;
  const data = (await r.json()) as { items?: { articles: TopArticle[] }[] };
  const articles = data.items?.[0]?.articles ?? [];
  const tm: TopMonth = { yyyymm: `${yyyy}-${mm}`, articles };
  writeJson(file, tm);
  return tm;
}

// ---------------------------------------------------------------------------
// Step 2 — Wikipedia summary (gives wikibase QID + langlinks proxy for
// sitelinks). Cached per slug.

interface SummaryCacheEntry {
  title: string;
  extract: string;
  description?: string;
  wikibase_item?: string;
  content_url?: string;
  type: string;
  langlinks: number;
}

async function getSummary(slug: string): Promise<SummaryCacheEntry | null> {
  const key = path.join(SUMMARY_CACHE, safeSlugKey(slug) + '.json');
  const cached = safeReadJson<SummaryCacheEntry | null>(key);
  if (cached !== null) return cached;
  // Use the action API instead of REST summary so we get langlinks in
  // the same call. Two-call alternative is REST /page/summary +
  // /page/links/{slug}?prop=langlinks but action API condenses.
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=info|pageprops|extracts|langlinks|description&titles=${encodeURIComponent(slug)}&exintro=1&explaintext=1&inprop=url&lllimit=500&redirects=1`;
  const r = await fetchWithRetry(url);
  if (!r || !r.ok) {
    writeJson(key, null);
    return null;
  }
  const data = (await r.json()) as {
    query?: {
      pages?: Record<string, {
        title?: string;
        missing?: '';
        extract?: string;
        description?: string;
        canonicalurl?: string;
        pageprops?: { wikibase_item?: string; disambiguation?: string };
        langlinks?: unknown[];
      }>;
    };
  };
  const pages = data.query?.pages ?? {};
  const firstKey = Object.keys(pages)[0];
  if (!firstKey) {
    writeJson(key, null);
    return null;
  }
  const page = pages[firstKey]!;
  if (page.missing === '' || firstKey === '-1') {
    writeJson(key, null);
    return null;
  }
  const isDisambig = page.pageprops?.disambiguation !== undefined;
  const entry: SummaryCacheEntry = {
    title: page.title ?? slug,
    extract: page.extract ?? '',
    description: page.description,
    wikibase_item: page.pageprops?.wikibase_item,
    content_url: page.canonicalurl,
    type: isDisambig ? 'disambiguation' : 'standard',
    // +1 for the English Wikipedia itself; matches the Wikidata sitelinks
    // count more closely.
    langlinks: (page.langlinks?.length ?? 0) + 1,
  };
  writeJson(key, entry);
  return entry;
}

// ---------------------------------------------------------------------------
// Step 3 — Wikidata Q5 / fictional check. Same pattern as the validator's
// getWikidata().

interface WikidataInfo { human: boolean; fictional: boolean; sitelinks: number }
const FICTIONAL_QIDS = new Set(['Q15632617', 'Q95074', 'Q3247054', 'Q15773347', 'Q21070568']);

async function getWikidataInfo(qid: string): Promise<WikidataInfo | null> {
  const key = path.join(WIKIDATA_CACHE, qid + '.json');
  const cached = safeReadJson<WikidataInfo | null>(key);
  if (cached !== null) return cached;
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`;
  const r = await fetchWithRetry(url);
  if (!r || !r.ok) {
    writeJson(key, null);
    return null;
  }
  const data = (await r.json()) as {
    entities?: Record<string, {
      claims?: { P31?: Array<{ mainsnak?: { datavalue?: { value?: { id?: string } } } }> };
      sitelinks?: Record<string, unknown>;
    }>;
  };
  const ent = data.entities?.[qid];
  if (!ent) {
    writeJson(key, null);
    return null;
  }
  const p31Ids = (ent.claims?.P31 ?? [])
    .map((c) => c.mainsnak?.datavalue?.value?.id)
    .filter((x): x is string => Boolean(x));
  const info: WikidataInfo = {
    human: p31Ids.includes('Q5'),
    fictional: p31Ids.some((q) => FICTIONAL_QIDS.has(q)),
    sitelinks: Object.keys(ent.sitelinks ?? {}).length,
  };
  writeJson(key, info);
  return info;
}

// ---------------------------------------------------------------------------
// Step 4 — Pageviews. Trailing 12 months, sum of user views.

async function getPageviews(slug: string, refresh: boolean): Promise<number> {
  const key = path.join(PAGEVIEWS_CACHE, safeSlugKey(slug) + '.json');
  if (!refresh) {
    const cached = safeReadJson<{ total: number }>(key);
    // Only trust a cached non-zero total — a cached zero from a previous
    // run is almost always a transient rate-limit / 429 the retry loop
    // couldn't recover from (Wikimedia REST throttles aggressively under
    // burst load, and the prior version of this script cached zeros).
    // Re-fetch zeros so famous names like Lionel Messi (cached as 0)
    // get their real ~634k/month views.
    if (cached && cached.total > 0) return cached.total;
  }
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), 1));
  const fmt = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}0100`;
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(slug)}/monthly/${fmt(start)}/${fmt(end)}`;
  const r = await fetchWithRetry(url);
  if (!r || !r.ok) {
    // Don't poison the cache with a zero on transient failures — leave
    // the existing cached value (if any) in place. The next run will
    // see it as either a real number (good) or a stale zero (which the
    // cached-zero check above forces a refetch on anyway).
    const cached = safeReadJson<{ total: number }>(key);
    return cached?.total ?? 0;
  }
  const data = (await r.json()) as { items?: { views?: number }[] };
  let total = 0;
  for (const it of data.items ?? []) total += it.views ?? 0;
  writeJson(key, { total });
  return total;
}

// ---------------------------------------------------------------------------
// Heuristic filter for "this top-monthly article title looks like a person"
// — strips out the obvious non-people pages (Lists, films, events, Special:,
// disambig hints). The proper filter is the Q5 Wikidata check that runs
// next; this is purely to avoid burning API calls on Main_Page-tier titles.

function plausiblyAPerson(title: string): boolean {
  if (!title) return false;
  if (title.includes(':')) return false; // Special:, Wikipedia:, File:, Category:, etc.
  if (title === 'Main_Page') return false;
  if (title.startsWith('List_of_')) return false;
  if (title.startsWith('Lists_of_')) return false;
  if (/^\d/.test(title)) return false; // Years, calendar pages
  // Multi-word "Foo of Bar"-style titles often aren't people, but they
  // CAN be (Joan of Arc) so don't filter on `of`. Same logic for `and`.
  return true;
}

// ---------------------------------------------------------------------------
// Pipeline

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));
  ensureDir(CACHE_DIR);
  ensureDir(TOP_CACHE);
  ensureDir(SUMMARY_CACHE);
  ensureDir(WIKIDATA_CACHE);
  ensureDir(PAGEVIEWS_CACHE);

  // ----- Phase 1: parse existing famousPeople.ts ---------------------------
  process.stderr.write('Phase 1: parsing existing famousPeople.ts\n');
  const existingRaw = fs.readFileSync(TARGET, 'utf8');
  const existing = parseExisting(existingRaw);
  process.stderr.write(`  ${existing.entries.length} entries parsed\n`);

  // ----- Phase 2: fetch top-monthly ---------------------------------------
  process.stderr.write('Phase 2: fetching top-monthly Wikipedia articles (last 12 months)\n');
  const months = trailingMonths(12);
  const monthData: (TopMonth | null)[] = await pmap(months, 3, async (m) => {
    return await fetchTopMonth(m.yyyy, m.mm, flags.refreshTop);
  });
  const successes = monthData.filter((m): m is TopMonth => m !== null);
  process.stderr.write(`  fetched ${successes.length}/${months.length} months\n`);

  // Aggregate by article. Sum views as a 12-month total signal.
  const topAgg = new Map<string, number>();
  for (const m of successes) {
    for (const a of m.articles) {
      if (!plausiblyAPerson(a.article)) continue;
      topAgg.set(a.article, (topAgg.get(a.article) ?? 0) + a.views);
    }
  }
  process.stderr.write(`  ${topAgg.size} unique candidate titles after person-plausibility filter\n`);

  // ----- Phase 3: build candidate pool -------------------------------------
  // Source 1: existing entries (preserve buckets + descriptions + slugs).
  // Source 2: top-monthly titles (treat title as both name and slug;
  //   refine to canonical title after the summary fetch).
  const candidates: Map<string, SourceEntry> = new Map(); // key: slug
  for (const e of existing.entries) {
    const slug = e.slug && e.slug.trim() !== '' ? e.slug : slugify(e.name);
    candidates.set(slug, {
      name: e.name,
      slug,
      description: e.description,
      originalBucket: e.bucket,
      source: 'existing',
    });
  }
  for (const [title] of topAgg) {
    if (!candidates.has(title)) {
      // For top-monthly entries we treat the article slug as both name
      // and slug; the summary fetch will normalize the title later.
      candidates.set(title, {
        name: title.replace(/_/g, ' '),
        slug: title,
        source: 'top-monthly',
      });
    }
  }
  process.stderr.write(`Phase 3: candidate pool size: ${candidates.size}\n`);

  // ----- Phase 4: enrich with summary + wikidata -------------------------
  // For each candidate, fetch the Wikipedia summary (canonical title +
  // langlinks + wikibase QID) and then Wikidata (Q5 confirmation +
  // exact sitelinks). Anything that isn't Q5 gets filtered out here.
  process.stderr.write('Phase 4: enriching candidates with Wikipedia + Wikidata\n');
  const list = [...candidates.values()];
  interface Enriched extends SourceEntry {
    canonicalTitle: string;
    qid?: string;
    isHuman: boolean;
    isFictional: boolean;
    sitelinks: number;
    langlinks: number;
    extract: string;
    /** Wikidata's one-liner ("American actor and filmmaker, born 1956").
     *  Strictly better than the first-sentence-of-extract fallback for
     *  the suggestion-panel description: it's hand-curated, short, and
     *  doesn't start with the bracketed pronunciation gunk. */
    wikidataDescription?: string;
  }
  let enrichedCount = 0;
  const enriched = await pmap<SourceEntry, Enriched | null>(list, 8, async (c) => {
    enrichedCount++;
    if (enrichedCount % 200 === 0) process.stderr.write(`  ${enrichedCount}/${list.length}\n`);
    const sum = await getSummary(c.slug);
    if (!sum) return null;
    if (sum.type !== 'standard') return null;
    const qid = sum.wikibase_item;
    let wd: WikidataInfo | null = null;
    if (qid) wd = await getWikidataInfo(qid);
    // If Wikidata is unavailable, fall back to the langlinks signal and
    // accept the entry conditionally — the description heuristic
    // ("X is/was a/an Y") is a reasonable person-vs-place fallback,
    // matches the validator's isPerson tail.
    let isHuman = false;
    let isFictional = false;
    let sitelinks = sum.langlinks;
    if (wd) {
      isHuman = wd.human && !wd.fictional;
      isFictional = wd.fictional;
      // Prefer Wikidata's sitelinks count when we have it; it captures
      // Wikiquote/Wikisource/Commons in addition to Wikipedia language
      // editions, so it's strictly more comprehensive than langlinks.
      sitelinks = wd.sitelinks;
    }
    // Crucially: when a QID exists and Wikidata says NOT human (and not
    // fictional), DO NOT fall back to extract heuristics. The first
    // attempt let "North Korea" and "Washington, D.C." through because
    // their summaries open "X is a country / X is the capital..." which
    // matches the "is/was a/an" pattern. With a Wikidata answer in
    // hand, trust it. Heuristic fallback is only for entries with no
    // QID at all (Pantheon-style stragglers).
    else if (!qid) {
      const e = sum.extract ?? '';
      if (
        /\(born\s+\d{1,2}\s+\w+|\(born\s+\d{3,4}\)/i.test(e) ||
        /\(\d{3,4}\s*[–\-—]\s*(?:\d{3,4}|present)\)/i.test(e) ||
        /\b(?:is|was|were)\s+(?:an?|the)\s+[A-Z]?[a-z]/i.test(e.split(/\.\s/, 1)[0] ?? '')
      ) {
        isHuman = true;
      }
    }
    return {
      ...c,
      canonicalTitle: sum.title,
      qid,
      isHuman,
      isFictional,
      sitelinks,
      langlinks: sum.langlinks,
      extract: sum.extract,
      wikidataDescription: sum.description,
    };
  });
  const humansRaw = enriched.filter((e): e is Enriched => Boolean(e?.isHuman) && !e.isFictional);
  // Dedupe by canonical title (handles redirects: "Leo XIV" and
  // "Pope Leo XIV" resolve to the same canonical via /redirects=1) AND
  // by QID when available (extra safety). Keep the entry whose
  // candidate name most closely matches the canonical title — that's
  // usually the existing curated entry over a top-monthly hit.
  const byCanon = new Map<string, Enriched>();
  for (const h of humansRaw) {
    const key = h.qid ? `qid:${h.qid}` : `title:${h.canonicalTitle}`;
    const prev = byCanon.get(key);
    if (!prev) {
      byCanon.set(key, h);
      continue;
    }
    // Tiebreaker: prefer the existing entry (curated wins) over a
    // top-monthly catch; within a source, prefer the entry whose name
    // already matches the canonical (i.e., not a parenthetical-disambig
    // variant like "Charlie Kirk (activist)").
    const prevMatchesCanon = prev.name === prev.canonicalTitle;
    const thisMatchesCanon = h.name === h.canonicalTitle;
    if (prev.source === 'existing' && h.source !== 'existing') continue;
    if (prev.source !== 'existing' && h.source === 'existing') {
      byCanon.set(key, h);
      continue;
    }
    if (!prevMatchesCanon && thisMatchesCanon) byCanon.set(key, h);
  }
  const humans = [...byCanon.values()];
  process.stderr.write(`  humans: ${humans.length} (deduped from ${humansRaw.length}) / ${enriched.length}\n`);

  // ----- Phase 5: per-pair top-K by sitelinks → fetch pageviews ----------
  // Bucket every human by the bucket-assignment rule:
  //   - if it came from `existing` AND was placed in a non-playerInitials
  //     bucket (Pattern-C case like A. J. Foyt in AJ), keep the original
  //     bucket so the suggestion panel placement is preserved;
  //   - else use playerInitials on the CANONICAL title (post-redirect),
  //     which is what a player would see and re-type.
  process.stderr.write('Phase 5: bucketing + fetching pageviews\n');
  const buckets = new Map<string, Enriched[]>();
  for (const h of humans) {
    let bucket: string;
    if (h.source === 'existing' && h.originalBucket) {
      bucket = h.originalBucket;
    } else {
      bucket = playerInitials(h.canonicalTitle);
    }
    if (!bucket) continue;
    if (flags.pair && bucket !== flags.pair) continue;
    const arr = buckets.get(bucket) ?? [];
    arr.push(h);
    buckets.set(bucket, arr);
  }
  process.stderr.write(`  ${buckets.size} pairs populated\n`);

  // Filter each pair's candidate list to top-K by sitelinks before
  // fetching pageviews — avoids burning calls on the long tail.
  const toScore: Enriched[] = [];
  for (const [, arr] of buckets) {
    arr.sort((a, b) => b.sitelinks - a.sitelinks);
    for (const c of arr.slice(0, TOP_K_FOR_PAGEVIEWS)) toScore.push(c);
  }
  process.stderr.write(`  ${toScore.length} candidates queued for pageviews\n`);

  // Pageviews fetch with conservative concurrency (Wikimedia's REST API
  // soft-throttles aggressive callers; the prior curate pass saw silent
  // zeros on Cary Grant et al at concurrency=5+no-retry — we now retry
  // and cache, so it should settle.).
  let pvCount = 0;
  const pageviews = new Map<string, number>(); // canonicalTitle → views
  await pmap(toScore, 6, async (c) => {
    pvCount++;
    if (pvCount % 200 === 0) process.stderr.write(`  pageviews ${pvCount}/${toScore.length}\n`);
    const slug = slugify(c.canonicalTitle);
    const v = await getPageviews(slug, flags.refreshPageviews);
    pageviews.set(c.canonicalTitle, v);
  });

  // ----- Phase 6: score ---------------------------------------------------
  process.stderr.write('Phase 6: scoring\n');
  // Normalize on the log-transformed signal so a 10x view differential
  // moves the score linearly (Einstein at 5M views shouldn't dominate a
  // log-scale-fair celeb at 500k by 10x).
  const pvLogs = toScore.map((c) => Math.log10((pageviews.get(c.canonicalTitle) ?? 0) + 1));
  const slLogs = toScore.map((c) => Math.log10(c.sitelinks + 1));
  const pvMax = Math.max(...pvLogs, 1);
  const slMax = Math.max(...slLogs, 1);
  const scored: ScoredCandidate[] = toScore.map((c) => {
    const pv = pageviews.get(c.canonicalTitle) ?? 0;
    const pvNorm = Math.log10(pv + 1) / pvMax;
    const slNorm = Math.log10(c.sitelinks + 1) / slMax;
    const score = WEIGHTS.pageviews * pvNorm + WEIGHTS.sitelinks * slNorm;
    // Determine final bucket (same rule as Phase 5).
    let bucket: string;
    if (c.source === 'existing' && c.originalBucket) bucket = c.originalBucket;
    else bucket = playerInitials(c.canonicalTitle);
    return {
      ...c,
      bucket,
      qid: c.qid,
      isHuman: c.isHuman,
      isFictional: c.isFictional,
      pageviews: pv,
      sitelinks: c.sitelinks,
      score,
      pvNorm,
      slNorm,
    };
  });

  // ----- Phase 7: top-N per pair ------------------------------------------
  const byBucket = new Map<string, ScoredCandidate[]>();
  for (const s of scored) {
    if (!s.bucket) continue;
    const arr = byBucket.get(s.bucket) ?? [];
    arr.push(s);
    byBucket.set(s.bucket, arr);
  }
  for (const [k, arr] of byBucket) {
    arr.sort((a, b) => b.score - a.score);
    byBucket.set(k, arr);
  }

  // Construct the new dataset. For each pair, take top-N. If --pair was
  // passed, merge top-N into the existing dataset (preserving other
  // pairs untouched); else fully rebuild.
  const finalPairs = new Map<string, ScoredCandidate[]>();
  if (flags.pair) {
    // Single-pair mode: preserve all other pairs, replace just this one.
    const existingByPair = new Map<string, ParsedFile['entries']>();
    for (const e of existing.entries) {
      const arr = existingByPair.get(e.bucket) ?? [];
      arr.push(e);
      existingByPair.set(e.bucket, arr);
    }
    for (const [bucket, entries] of existingByPair) {
      if (bucket === flags.pair) continue;
      // Re-encode pre-existing entries as ScoredCandidate stubs.
      finalPairs.set(
        bucket,
        entries.map((e) => ({
          name: e.name,
          slug: e.slug && e.slug !== '' ? e.slug : slugify(e.name),
          description: e.description,
          originalBucket: bucket,
          source: 'existing' as const,
          canonicalTitle: e.name,
          bucket,
          isHuman: true,
          isFictional: false,
          pageviews: 0,
          sitelinks: 0,
          score: 0,
          pvNorm: 0,
          slNorm: 0,
          langlinks: 0,
          extract: '',
        }))
      );
    }
    const top = (byBucket.get(flags.pair) ?? []).slice(0, TOP_N_PER_PAIR);
    finalPairs.set(flags.pair, top);
  } else {
    for (const [bucket, arr] of byBucket) {
      finalPairs.set(bucket, arr.slice(0, TOP_N_PER_PAIR));
    }
  }

  // ----- Phase 8: synthesize descriptions --------------------------------
  // For entries whose pre-existing description is a Pantheon auto-tag
  // ("leadership", "culture", "writer") OR is missing, prefer the
  // Wikidata short description ("American actor and producer, born
  // 1969") over the Wikipedia first-sentence — the Wikidata one is
  // short, hand-curated, and skips the bracketed pronunciation chunk.
  // Fall back to a cleaned first-sentence when no Wikidata description
  // is available.
  process.stderr.write('Phase 8: synthesizing descriptions\n');
  // Build a lookup back to the Enriched record so we have both
  // wikidataDescription and extract to choose from.
  const enrichedByName = new Map<string, Enriched>();
  for (const h of humans) enrichedByName.set(h.name, h);
  function cleanFirstSentence(extract: string): string {
    if (!extract) return '';
    // Strip the parenthetical pronunciation / birth-date prefix that
    // English Wikipedia bios open with — readers don't want
    // "( BLAN-chit; born 14 May 1969) is an Australian actor".
    const noParens = extract.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    const idx = noParens.indexOf('. ');
    const sent = idx < 0 ? noParens.trim() : noParens.slice(0, idx + 1).trim();
    if (sent.length <= 110) return sent;
    const cut = sent.slice(0, 110);
    const lastBreak = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf(' — '), cut.lastIndexOf(' – '));
    return (lastBreak > 30 ? cut.slice(0, lastBreak) : cut.replace(/\s+\S*$/, '')) + '…';
  }
  function looksLikePlaceholder(d: string): boolean {
    const s = d.trim();
    if (!s) return true;
    const known = new Set([
      'leadership', 'culture', 'discovery/science', 'sports/games', 'other',
      'writer', 'musician', 'composer', 'actor', 'artist', 'philosopher',
      'physicist', 'biologist', 'mathematician', 'religious figure',
      'social activist', 'diplomat', 'inventor', 'businessperson',
      'soccer player', 'tennis player', 'model', 'presenter', 'engineer',
      'journalist', 'nobleman', 'fashion designer', 'psychologist',
      'astronomer', 'economist', 'film director', 'painter', 'sociologist',
      'military personnel', 'politician', 'chemist', 'public worker',
      'companion', 'singer', 'conductor',
    ]);
    if (known.has(s.toLowerCase())) return true;
    // Single token with no digit/comma is almost certainly a Pantheon
    // auto-tag. "writer", "musician", etc. — easier to over-trigger
    // here than under-trigger (we already have a Wikidata description
    // ready as a strict upgrade).
    if (!/[,\d]/.test(s) && /^[a-z][a-z\s/]*$/i.test(s) && s.split(/\s+/).length <= 3) return true;
    return false;
  }
  for (const [, arr] of finalPairs) {
    for (const c of arr) {
      const enriched = enrichedByName.get(c.name);
      const existingIsRich = c.description && !looksLikePlaceholder(c.description);
      if (existingIsRich) continue;
      const wd = enriched?.wikidataDescription?.trim();
      if (wd && wd.length > 2 && wd.length <= 140) {
        c.description = wd;
      } else {
        c.description = cleanFirstSentence(enriched?.extract || '');
      }
    }
  }

  // ----- Phase 9: emit ----------------------------------------------------
  process.stderr.write('Phase 9: emitting famousPeople.ts\n');
  const sortedBuckets = [...finalPairs.keys()].sort();
  const bodyLines: string[] = [''];
  for (const bucket of sortedBuckets) {
    const arr = finalPairs.get(bucket) ?? [];
    if (arr.length === 0) continue;
    const parts = arr.map((c) => {
      const out = [emitSq(c.name), emitSq(c.description ?? '')];
      // Preserve explicit slug when the existing entry had one OR when
      // our canonical title differs from name-derived slug (the entry
      // came from a Wikipedia redirect we need to point at directly).
      const derived = slugify(c.name);
      const slug = c.slug ?? derived;
      if (slug !== derived) out.push(emitSq(slug));
      return `p(${out.join(', ')})`;
    });
    bodyLines.push(`  ${bucket}: [${parts.join(', ')}],`);
  }
  bodyLines.push('');
  const newFile = existing.header + bodyLines.join('\n') + existing.footer;
  if (!flags.dryRun) {
    fs.writeFileSync(TARGET, newFile);
    process.stderr.write(`  wrote ${path.relative(ROOT, TARGET)}\n`);
  } else {
    process.stderr.write('  dry-run — not writing\n');
  }

  // ----- Phase 10: log ----------------------------------------------------
  process.stderr.write('Phase 10: writing build log\n');
  const lines: string[] = [];
  lines.push('# build-famous-people log');
  lines.push('');
  lines.push(`Weights: pageviews=${WEIGHTS.pageviews}, sitelinks=${WEIGHTS.sitelinks} (Pantheon HPI skipped — see script comment)`);
  lines.push('');
  const totalAfter = [...finalPairs.values()].reduce((s, a) => s + a.length, 0);
  lines.push(`Entries before: **${existing.entries.length}**`);
  lines.push(`Entries after:  **${totalAfter}**`);
  lines.push(`Pairs populated: **${[...finalPairs.values()].filter((a) => a.length > 0).length}** / 676`);
  lines.push('');

  // Top 5 from 10 randomly-picked pairs.
  const allPairs = [...finalPairs.keys()].sort();
  // Deterministic "random" — index-step through the alphabet so the
  // sample crosses A-, M-, and Z-prefix pairs.
  const sampleIndices = [0, Math.floor(allPairs.length * 0.1), Math.floor(allPairs.length * 0.2), Math.floor(allPairs.length * 0.3), Math.floor(allPairs.length * 0.45), Math.floor(allPairs.length * 0.55), Math.floor(allPairs.length * 0.65), Math.floor(allPairs.length * 0.75), Math.floor(allPairs.length * 0.85), allPairs.length - 1];
  lines.push('## Spot-check: top 5 from 10 sampled pairs');
  lines.push('');
  for (const idx of sampleIndices) {
    const b = allPairs[idx];
    if (!b) continue;
    const arr = finalPairs.get(b) ?? [];
    lines.push(`### ${b}`);
    arr.slice(0, 5).forEach((c, i) => {
      lines.push(`  ${i + 1}. **${c.name}** — pv=${c.pageviews}, sl=${c.sitelinks}, score=${c.score.toFixed(3)}`);
    });
    lines.push('');
  }

  // Top-25 newly ADDED entries.
  const existingNames = new Set(existing.entries.map((e) => e.name));
  const added: ScoredCandidate[] = [];
  for (const arr of finalPairs.values()) {
    for (const c of arr) if (!existingNames.has(c.name)) added.push(c);
  }
  added.sort((a, b) => b.score - a.score);
  lines.push('## Top-25 newly ADDED entries (modern celebs Pantheon missed)');
  lines.push('');
  for (const c of added.slice(0, 25)) {
    lines.push(`- **${c.bucket}** ${c.name} — pv=${c.pageviews}, sl=${c.sitelinks}, score=${c.score.toFixed(3)}`);
  }
  lines.push('');

  // Top-25 REMOVED entries (by sitelinks descending — most-famous things
  // dropped from the dataset). Reuse the enrichedByName lookup built
  // in Phase 8.
  const finalNames = new Set<string>();
  for (const arr of finalPairs.values()) for (const c of arr) finalNames.add(c.name);
  const removed: { name: string; bucket: string; sitelinks: number; pageviews: number }[] = [];
  for (const e of existing.entries) {
    if (finalNames.has(e.name)) continue;
    const h = enrichedByName.get(e.name);
    removed.push({
      name: e.name,
      bucket: e.bucket,
      sitelinks: h?.sitelinks ?? 0,
      pageviews: pageviews.get(h?.canonicalTitle ?? '') ?? 0,
    });
  }
  removed.sort((a, b) => b.sitelinks - a.sitelinks);
  lines.push('## Top-25 REMOVED entries (sanity-check the ranking didn\'t drop someone famous)');
  lines.push('');
  for (const r of removed.slice(0, 25)) {
    lines.push(`- **${r.bucket}** ${r.name} — pv=${r.pageviews}, sl=${r.sitelinks}`);
  }
  lines.push('');
  lines.push(`Total removed: ${removed.length}`);
  lines.push('');

  // Under-populated pairs.
  const thin: string[] = [];
  for (const b of allPairs) {
    const arr = finalPairs.get(b) ?? [];
    if (arr.length < 5) thin.push(`${b} (${arr.length})`);
  }
  lines.push('## Under-populated pairs (< 5 entries)');
  lines.push('');
  lines.push(thin.length === 0 ? '_(none)_' : thin.join(', '));
  lines.push('');

  fs.writeFileSync(LOG_PATH, lines.join('\n'));
  process.stderr.write(`Wrote ${path.relative(ROOT, LOG_PATH)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
