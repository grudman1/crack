// Two-pass curation script for src/data/famousPeople.ts.
//
// Pass 1 ("structural") — deterministic, no network for the bulk of the work.
// Flags three patterns where an entry's bucket disagrees with how a player
// would intuitively compute its initials:
//   A) "X of <place>" suffix       e.g. "Harald V of Norway" in HN
//   B) Roman-numeral tail          e.g. "Henry VIII" in HV
//   C) computeNameInitials(name) ≠ bucket   (sanity check)
//
// For each flagged entry the script either reassigns (when the pre-suffix
// form has clean two-token initials) or removes (when it collapses to a
// mononym). Reassignments HEAD-check the existing slug; on 404 they fall
// back to Wikipedia opensearch, and remove rather than guess if no clean
// match is found.
//
// Pass 2 ("fame") — Wikipedia pageviews + article length + Wikidata
// sitelinks. Drops an entry iff *all three* fall below the corresponding
// threshold. Long-dead encyclopedic figures keep their slot via the length
// and sitelinks guardrails.
//
// Usage:
//   npx tsx scripts/curate-famous-people.ts                  (both passes)
//   npx tsx scripts/curate-famous-people.ts --pass=structural
//   npx tsx scripts/curate-famous-people.ts --pass=fame
//   npx tsx scripts/curate-famous-people.ts --dry-run        (no writes)
//
// Outputs:
//   src/data/famousPeople.ts                 — rewritten in place
//   scripts/structural-audit.log.md          — Pass 1 decisions
//   scripts/prune-famous-people.removed.md   — Pass 2 decisions

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import { computeNameInitials } from '../src/services/wikiValidationService.ts';

// ---------------------------------------------------------------------------
// Types

interface Entry {
  name: string;
  description: string;
  /** Explicit slug from the source p() call, when the third arg was given. */
  slug?: string;
}

type Dataset = Map<string, Entry[]>;

interface ParsedFile {
  header: string;
  footer: string;
  pairs: Dataset;
}

// ---------------------------------------------------------------------------
// Constants

const ROOT = path.resolve(import.meta.dirname, '..');
const TARGET = path.join(ROOT, 'src/data/famousPeople.ts');
const STRUCTURAL_LOG = path.join(ROOT, 'scripts/structural-audit.log.md');
const FAME_LOG = path.join(ROOT, 'scripts/prune-famous-people.removed.md');

// Pass-2 cut thresholds. Tuned from the histogram on the first run; encoded
// here so re-runs on a cleaner dataset stay idempotent (entries that survive
// once won't be removed by a second run with the same constants).
const T1_PAGEVIEWS = 50_000;
const T2_ARTICLE_LEN = 5_000;
const T3_SITELINKS = 10;

const ROMAN_RE = /\s(I{1,3}|IV|V|VI{1,3}|IX|X|XI{1,3}|XIV|XV|XVI{1,3}|XIX|XX)\s*$/;
const OF_PLACE_RE = /\sof\s+\S+\s*$/i;
// Comma-delimited noble suffix attached to canonical Wikipedia titles
// ("Diana, Princess of Wales" → strip ", Princess of Wales"). When this
// matches we strip it instead of just " of <X>"; the noble role is part
// of the title, not part of the player's mental name.
const COMMA_NOBLE_RE =
  /,\s*(?:1st\s+|2nd\s+|3rd\s+|\d+th\s+)?(?:Duke|Duchess|Earl|Countess|Baron|Baroness|Viscount|Viscountess|Lord|Lady|Marquess|Marchioness|Prince|Princess|King|Queen|Pope|Saint|Sir|Dame|Count|Abbess|Abbot|Margrave|Emperor|Empress|Tsar|Tsarina|Czar)\s+of\s+.+$/i;

// ---------------------------------------------------------------------------
// Parser
//
// We don't use a real TS parser. The file is mechanically uniform: one pair
// per line, each entry a `p('name', 'description'[, 'slug'])` call. We carve
// out the body between `FAMOUS_PEOPLE: Record<...> = {` and the closing
// `};`, preserving the header and footer verbatim for re-emit.

const SQ_STR_SRC = "'((?:\\\\.|[^'\\\\])*)'";
const P_CALL = new RegExp(
  `p\\(\\s*${SQ_STR_SRC}\\s*,\\s*${SQ_STR_SRC}(?:\\s*,\\s*${SQ_STR_SRC})?\\s*\\)`,
  'g',
);

function unescapeSq(s: string): string {
  // Reverse the escapes used inside single-quoted source strings.
  return s.replace(/\\(.)/g, '$1');
}

function emitSq(s: string): string {
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function parseFile(text: string): ParsedFile {
  const openMarker = 'export const FAMOUS_PEOPLE: Record<string, Suggestion[]> = {';
  const openIdx = text.indexOf(openMarker);
  if (openIdx < 0) throw new Error('Could not find FAMOUS_PEOPLE opener');
  const bodyStart = openIdx + openMarker.length;
  // Find the matching closing `};` — the file ends with one. Use the last
  // `};` before EOF as the closer.
  const closeIdx = text.lastIndexOf('};');
  if (closeIdx < 0 || closeIdx < bodyStart) {
    throw new Error('Could not find FAMOUS_PEOPLE closer');
  }
  const header = text.slice(0, bodyStart);
  const footer = text.slice(closeIdx);
  const body = text.slice(bodyStart, closeIdx);

  const pairs: Dataset = new Map();
  // Each pair line: `  XY: [p(...), p(...), ...],`
  // Process line-by-line so a malformed pair fails loudly with line context.
  const lines = body.split('\n');
  for (const raw of lines) {
    const m = raw.match(/^\s*([A-Z]{2})\s*:\s*\[(.*)\],?\s*$/);
    if (!m) continue;
    const pair = m[1]!;
    const inner = m[2]!;
    const entries: Entry[] = [];
    let cm: RegExpExecArray | null;
    P_CALL.lastIndex = 0;
    while ((cm = P_CALL.exec(inner)) !== null) {
      const name = unescapeSq(cm[1]!);
      const description = unescapeSq(cm[2]!);
      const slug = cm[3] != null ? unescapeSq(cm[3]) : undefined;
      const e: Entry = { name, description };
      if (slug != null) e.slug = slug;
      entries.push(e);
    }
    if (entries.length === 0) {
      // No-op: the original file omits empty pairs entirely. If we end up
      // with one after a pass, we drop it from the output rather than
      // emitting `XY: [],`.
    }
    pairs.set(pair, entries);
  }
  return { header, footer, pairs };
}

// ---------------------------------------------------------------------------
// Emitter

function emitEntry(e: Entry): string {
  const parts = [emitSq(e.name), emitSq(e.description)];
  if (e.slug != null && e.slug !== '') parts.push(emitSq(e.slug));
  return `p(${parts.join(', ')})`;
}

function renderFile(parsed: ParsedFile): string {
  const sorted = [...parsed.pairs.entries()].sort(([a], [b]) => a.localeCompare(b));
  const bodyLines: string[] = [''];
  for (const [pair, entries] of sorted) {
    if (entries.length === 0) continue;
    const joined = entries.map(emitEntry).join(', ');
    bodyLines.push(`  ${pair}: [${joined}],`);
  }
  bodyLines.push('');
  return parsed.header + bodyLines.join('\n') + parsed.footer;
}

// ---------------------------------------------------------------------------
// HTTP helpers — Wikipedia / Wikimedia

const USER_AGENT =
  'crack-famous-people-curator/1.0 (https://github.com/gavinrudman/crack; contact: curator@example.com) node-fetch';

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, attempts = 4): Promise<Response | null> {
  let backoff = 500;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT } });
      if (r.status === 429 || r.status >= 500) {
        await sleep(backoff);
        backoff *= 2;
        continue;
      }
      return r;
    } catch {
      await sleep(backoff);
      backoff *= 2;
    }
  }
  return null;
}

function deriveSlug(e: Entry): string {
  if (e.slug && e.slug.trim() !== '') return e.slug;
  return e.name.replace(/ /g, '_');
}

async function headExists(slug: string): Promise<boolean> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}?redirect=true`;
  const r = await fetchWithRetry(url);
  if (!r) return false;
  return r.ok;
}

async function opensearchFirstHitTitle(query: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=3&search=${encodeURIComponent(query)}`;
  const r = await fetchWithRetry(url);
  if (!r || !r.ok) return null;
  const j = (await r.json()) as unknown;
  if (!Array.isArray(j) || j.length < 4) return null;
  const titles = j[1];
  if (!Array.isArray(titles) || titles.length === 0) return null;
  return typeof titles[0] === 'string' ? titles[0] : null;
}

interface PageMeta {
  pageviews: number;
  articleLen: number;
  sitelinks: number;
  resolvedTitle: string;
  notFound: boolean;
}

interface WpQueryResp {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        length?: number;
        missing?: '';
        pageprops?: { wikibase_item?: string };
      }
    >;
  };
}

interface WdEntityResp {
  entities?: Record<string, { sitelinks?: Record<string, unknown> }>;
}

interface PageviewsResp {
  items?: { views?: number }[];
}

async function fetchPageMeta(slug: string): Promise<PageMeta> {
  const empty: PageMeta = {
    pageviews: 0,
    articleLen: 0,
    sitelinks: 0,
    resolvedTitle: slug,
    notFound: false,
  };

  // (1) info + pageprops to get length + wikidata QID. redirects=1 follows.
  const wpUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=info|pageprops&titles=${encodeURIComponent(slug)}&redirects=1`;
  const wpRes = await fetchWithRetry(wpUrl);
  if (!wpRes || !wpRes.ok) return { ...empty, notFound: true };
  const wp = (await wpRes.json()) as WpQueryResp;
  const pages = wp.query?.pages ?? {};
  const firstKey = Object.keys(pages)[0];
  if (!firstKey) return { ...empty, notFound: true };
  const page = pages[firstKey]!;
  if (page.missing === '' || firstKey === '-1') return { ...empty, notFound: true };
  const resolvedTitle = page.title ?? slug;
  const articleLen = page.length ?? 0;
  const qid = page.pageprops?.wikibase_item;

  // (2) Wikidata sitelinks count.
  let sitelinks = 0;
  if (qid) {
    const wdUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&ids=${encodeURIComponent(qid)}&props=sitelinks`;
    const wdRes = await fetchWithRetry(wdUrl);
    if (wdRes && wdRes.ok) {
      const wd = (await wdRes.json()) as WdEntityResp;
      const ent = wd.entities?.[qid];
      if (ent && ent.sitelinks) sitelinks = Object.keys(ent.sitelinks).length;
    }
  }

  // (3) Pageviews — trailing 12 months of monthly user views, summed.
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), 1));
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}0100`;
  const pvUrl = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(
    resolvedTitle.replace(/ /g, '_'),
  )}/monthly/${fmt(start)}/${fmt(end)}`;
  let pageviews = 0;
  const pvRes = await fetchWithRetry(pvUrl);
  if (pvRes && pvRes.ok) {
    const pv = (await pvRes.json()) as PageviewsResp;
    for (const it of pv.items ?? []) pageviews += it.views ?? 0;
  }

  return { pageviews, articleLen, sitelinks, resolvedTitle, notFound: false };
}

// Simple concurrent map with a fixed worker pool. Returns results in the
// same order as input. We use small concurrency (4) to stay polite —
// pageviews REST and the action API rate-limit per-IP.
async function pmap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
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
// Pass 1 — structural audit

interface StructuralDecision {
  bucket: string;
  entry: Entry;
  pattern: 'of-place' | 'roman-tail' | 'mismatch';
  action: 'reassign' | 'remove' | 'leave';
  newBucket?: string;
  newEntry?: Entry;
  note: string;
}

function stripOfPlace(name: string): string {
  // Prefer the comma-noble strip when it matches — it captures the full
  // " ,Title of Place" tail rather than just " of Place". So
  //   "Diana, Princess of Wales"     → "Diana"          (mononym → removed)
  //   "Beatrice I, Abbess of Quedlinburg" → "Beatrice I" (mononym → removed)
  // and only "Harald V of Norway" / "Henry VIII of England" style entries
  // — where the leading form is the player's actual mental name — drop
  // through to the plain " of <X>" strip.
  if (COMMA_NOBLE_RE.test(name)) return name.replace(COMMA_NOBLE_RE, '').trim();
  return name.replace(OF_PLACE_RE, '').trim();
}

function stripRomanTail(name: string): string {
  return name.replace(ROMAN_RE, '').trim();
}

function rawTokens(name: string): string[] {
  return name
    .replace(/\([^)]*\)/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function tokenCount(name: string): number {
  return rawTokens(name).length;
}

/** Player-mental-model initials: literal first letter of the first token and
 *  the last token, without stripping the validator's SUFFIXES set. Roman
 *  numerals stay first-class tokens here — "Harald V" → "HV", not "" —
 *  because the curation logic decides bucket placement from how players
 *  type names, not from how the validator filters tokens. */
function playerInitials(name: string): string {
  const tokens = rawTokens(name);
  if (tokens.length < 2) return '';
  const first = tokens[0]!.replace(/[.,;]+$/, '');
  const last = tokens[tokens.length - 1]!.replace(/[.,;]+$/, '');
  if (!first || !last) return '';
  return (first[0] ?? '').toUpperCase() + (last[0] ?? '').toUpperCase();
}

async function decideStructural(
  bucket: string,
  entry: Entry,
  pattern: StructuralDecision['pattern'],
): Promise<StructuralDecision> {
  // Idempotency guard for Patterns A and B: if the entry carries an
  // explicit slug that differs from its name-derived slug, it was likely
  // produced by a previous Pass-1 reassign (or hand-curated). Don't re-
  // strip / re-remove it — its bucket has already been decided. Without
  // this guard, the reassigned "Catherine II" in CI would have Pattern B
  // re-strip " II" → "Catherine" (mononym) → remove on a second run.
  if (pattern !== 'mismatch') {
    const derived = entry.name.replace(/ /g, '_');
    if (entry.slug && entry.slug !== derived) {
      return {
        bucket,
        entry,
        pattern,
        action: 'leave',
        note: `explicit slug "${entry.slug}" differs from derived "${derived}" — treat as previously curated`,
      };
    }
  }

  // `stripped` is the form used to evaluate bucket assignment (the player's
  // mental name). `displayName` is what gets emitted as the new entry's
  // `name` after a reassign — for Pattern A we drop the " of <place>" tail
  // (matching the user's `Harald V of Norway → Harald V` example), but for
  // Pattern B we keep the Roman numeral so popes/regents stay
  // distinguishable in the suggestion panel.
  let stripped: string;
  let displayName: string;
  if (pattern === 'of-place') {
    stripped = stripOfPlace(entry.name);
    displayName = stripped;
  } else if (pattern === 'roman-tail') {
    stripped = stripRomanTail(entry.name);
    displayName = entry.name;
  } else {
    stripped = entry.name;
    displayName = entry.name;
  }

  // For pattern C (mismatch), we don't attempt to reassign — these are
  // typically intentional "first-initial style" entries like "A. J. Foyt"
  // filed under AJ. We log them so the user can decide; the bucket already
  // matches the player mental model.
  if (pattern === 'mismatch') {
    const computed = computeNameInitials(entry.name);
    return {
      bucket,
      entry,
      pattern,
      action: 'leave',
      note: `computeNameInitials="${computed}" bucket="${bucket}" — flagged for review; not auto-touched.`,
    };
  }

  if (tokenCount(stripped) < 2) {
    return {
      bucket,
      entry,
      pattern,
      action: 'remove',
      note: `pre-suffix "${stripped}" collapses to mononym`,
    };
  }
  const initials = playerInitials(stripped);
  if (!initials) {
    return {
      bucket,
      entry,
      pattern,
      action: 'remove',
      note: `pre-suffix "${stripped}" has no computable initials`,
    };
  }
  if (initials === bucket) {
    return {
      bucket,
      entry,
      pattern,
      action: 'leave',
      note: `pre-suffix "${stripped}" initials already match current bucket — leave alone`,
    };
  }

  // Verify the existing slug resolves before reassigning. If it 404s,
  // try opensearch with the original name; if no clean hit, remove.
  const existingSlug = deriveSlug(entry);
  const exists = await headExists(existingSlug);
  let useSlug = existingSlug;
  if (!exists) {
    const hit = await opensearchFirstHitTitle(entry.name);
    if (!hit) {
      return {
        bucket,
        entry,
        pattern,
        action: 'remove',
        note: `slug "${existingSlug}" 404s and opensearch returned no hit`,
      };
    }
    useSlug = hit.replace(/ /g, '_');
  }

  const newEntry: Entry = {
    name: displayName,
    description: entry.description,
    slug: useSlug,
  };
  return {
    bucket,
    entry,
    pattern,
    action: 'reassign',
    newBucket: initials,
    newEntry,
    note: `pre-suffix "${stripped}" → bucket ${initials}, slug ${useSlug}`,
  };
}

async function runStructuralPass(parsed: ParsedFile): Promise<{
  decisions: StructuralDecision[];
  beforeCount: number;
  afterCount: number;
}> {
  const decisions: StructuralDecision[] = [];
  let beforeCount = 0;
  for (const entries of parsed.pairs.values()) beforeCount += entries.length;

  // Collect candidates first so we don't mutate while iterating.
  type Candidate = { bucket: string; entry: Entry; pattern: StructuralDecision['pattern'] };
  const candidates: Candidate[] = [];
  for (const [bucket, entries] of parsed.pairs) {
    for (const e of entries) {
      if (OF_PLACE_RE.test(e.name)) {
        candidates.push({ bucket, entry: e, pattern: 'of-place' });
        continue;
      }
      if (ROMAN_RE.test(e.name)) {
        candidates.push({ bucket, entry: e, pattern: 'roman-tail' });
        continue;
      }
      const computed = computeNameInitials(e.name);
      if (computed && computed !== bucket) {
        candidates.push({ bucket, entry: e, pattern: 'mismatch' });
      }
    }
  }

  // Resolve each candidate, possibly HEAD-checking the slug.
  const resolved = await pmap(candidates, 4, (c) =>
    decideStructural(c.bucket, c.entry, c.pattern),
  );
  decisions.push(...resolved);

  // Apply decisions to the dataset.
  for (const d of decisions) {
    if (d.action === 'leave') continue;
    const arr = parsed.pairs.get(d.bucket);
    if (!arr) continue;
    const idx = arr.indexOf(d.entry);
    if (idx < 0) continue;
    arr.splice(idx, 1);
    if (d.action === 'reassign' && d.newBucket && d.newEntry) {
      const target = parsed.pairs.get(d.newBucket) ?? [];
      // Skip if an entry with the same name already exists in the target.
      if (!target.some((x) => x.name === d.newEntry!.name)) {
        target.push(d.newEntry);
      }
      parsed.pairs.set(d.newBucket, target);
    }
  }

  let afterCount = 0;
  for (const entries of parsed.pairs.values()) afterCount += entries.length;
  return { decisions, beforeCount, afterCount };
}

function writeStructuralLog(
  decisions: StructuralDecision[],
  before: number,
  after: number,
): void {
  const lines: string[] = [];
  lines.push('# Structural audit log');
  lines.push('');
  lines.push(`Entries before pass: **${before}**`);
  lines.push(`Entries after pass: **${after}**`);
  lines.push(`Decisions: **${decisions.length}**`);
  lines.push('');

  const groups: Record<StructuralDecision['pattern'], StructuralDecision[]> = {
    'of-place': [],
    'roman-tail': [],
    mismatch: [],
  };
  for (const d of decisions) groups[d.pattern].push(d);

  const sectionTitle: Record<StructuralDecision['pattern'], string> = {
    'of-place': '## Pattern A — `X of <place>` suffix',
    'roman-tail': '## Pattern B — Roman-numeral tail',
    mismatch: '## Pattern C — `computeNameInitials(name)` ≠ bucket',
  };

  for (const pat of ['of-place', 'roman-tail', 'mismatch'] as const) {
    const items = groups[pat];
    lines.push(sectionTitle[pat]);
    const reassigns = items.filter((d) => d.action === 'reassign').length;
    const removes = items.filter((d) => d.action === 'remove').length;
    const leaves = items.filter((d) => d.action === 'leave').length;
    lines.push('');
    lines.push(`Total: ${items.length}  ·  reassign: ${reassigns}  ·  remove: ${removes}  ·  leave: ${leaves}`);
    lines.push('');
    if (items.length === 0) {
      lines.push('_(none)_');
      lines.push('');
      continue;
    }
    for (const d of items) {
      const oldLine = `p(${emitSq(d.entry.name)}, ${emitSq(d.entry.description)}${d.entry.slug ? `, ${emitSq(d.entry.slug)}` : ''})`;
      lines.push(`- **${d.bucket}** · _${d.action}_ — \`${oldLine}\``);
      if (d.action === 'reassign' && d.newBucket && d.newEntry) {
        const newLine = `p(${emitSq(d.newEntry.name)}, ${emitSq(d.newEntry.description)}${d.newEntry.slug ? `, ${emitSq(d.newEntry.slug)}` : ''})`;
        lines.push(`    → **${d.newBucket}**: \`${newLine}\``);
      }
      lines.push(`    · ${d.note}`);
    }
    lines.push('');
  }

  fs.writeFileSync(STRUCTURAL_LOG, lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Pass 2 — fame floor

interface FameScore {
  bucket: string;
  entry: Entry;
  meta: PageMeta;
  drop: boolean;
}

function logScaleBucket(views: number): number {
  if (views <= 0) return 0;
  return Math.floor(Math.log10(views));
}

function histogram(scores: number[], label: string): string {
  const bins = new Map<number, number>();
  for (const v of scores) {
    const b = logScaleBucket(v);
    bins.set(b, (bins.get(b) ?? 0) + 1);
  }
  const sorted = [...bins.entries()].sort(([a], [b]) => a - b);
  const max = Math.max(0, ...bins.values());
  const lines: string[] = [`### ${label} (log10 bins)`, ''];
  for (const [b, n] of sorted) {
    const lo = b === 0 ? '0' : `1e${b}`;
    const hi = `1e${b + 1}`;
    const bar = max === 0 ? '' : '█'.repeat(Math.round((40 * n) / max));
    lines.push(`\`${lo.padStart(5)}…${hi.padEnd(5)}\` ${String(n).padStart(5)}  ${bar}`);
  }
  return lines.join('\n');
}

async function runFamePass(parsed: ParsedFile): Promise<{
  scores: FameScore[];
  removed: FameScore[];
  beforeCount: number;
  afterCount: number;
  emptyPairs: string[];
}> {
  let beforeCount = 0;
  const flat: { bucket: string; entry: Entry }[] = [];
  for (const [bucket, entries] of parsed.pairs) {
    beforeCount += entries.length;
    for (const e of entries) flat.push({ bucket, entry: e });
  }

  process.stderr.write(`Fame pass: scoring ${flat.length} entries...\n`);
  const scores: FameScore[] = await pmap(flat, 5, async ({ bucket, entry }, idx) => {
    if (idx % 50 === 0) process.stderr.write(`  ${idx}/${flat.length}\n`);
    const slug = deriveSlug(entry);
    const meta = await fetchPageMeta(slug);
    const drop =
      !meta.notFound &&
      meta.pageviews < T1_PAGEVIEWS &&
      meta.articleLen < T2_ARTICLE_LEN &&
      meta.sitelinks < T3_SITELINKS;
    return { bucket, entry, meta, drop };
  });

  // Apply removals.
  for (const s of scores) {
    if (!s.drop) continue;
    const arr = parsed.pairs.get(s.bucket);
    if (!arr) continue;
    const idx = arr.indexOf(s.entry);
    if (idx >= 0) arr.splice(idx, 1);
  }

  // Empty pairs — leave the key out of the output but record them.
  const emptyPairs: string[] = [];
  for (const [bucket, entries] of parsed.pairs) {
    if (entries.length === 0) emptyPairs.push(bucket);
  }
  for (const bucket of emptyPairs) parsed.pairs.delete(bucket);

  let afterCount = 0;
  for (const entries of parsed.pairs.values()) afterCount += entries.length;
  const removed = scores.filter((s) => s.drop);
  return { scores, removed, beforeCount, afterCount, emptyPairs };
}

function writeFameLog(
  scores: FameScore[],
  removed: FameScore[],
  before: number,
  after: number,
  emptyPairs: string[],
): void {
  const lines: string[] = [];
  lines.push('# Fame-floor prune log');
  lines.push('');
  lines.push(`Thresholds (drop iff ALL three fail):`);
  lines.push(`- pageviews < **${T1_PAGEVIEWS}** (12mo user views)`);
  lines.push(`- article_len < **${T2_ARTICLE_LEN}** (bytes)`);
  lines.push(`- sitelinks < **${T3_SITELINKS}** (wikidata interlanguage)`);
  lines.push('');
  lines.push(`Entries before pass: **${before}**`);
  lines.push(`Entries removed: **${removed.length}**`);
  lines.push(`Entries after pass: **${after}**`);
  lines.push('');
  lines.push(histogram(scores.map((s) => s.meta.pageviews), 'Pageviews distribution (all entries scored)'));
  lines.push('');
  lines.push(histogram(scores.map((s) => s.meta.articleLen), 'Article-length distribution (bytes)'));
  lines.push('');

  // Top-10 highest-scoring removals (the borderlines).
  const removedSorted = [...removed].sort((a, b) => b.meta.pageviews - a.meta.pageviews);
  lines.push('## Top-10 highest-scoring removals (borderlines worth sanity-checking)');
  lines.push('');
  for (const s of removedSorted.slice(0, 10)) {
    lines.push(
      `- **${s.bucket}** \`${s.entry.name}\` — pageviews: ${s.meta.pageviews} · article_len: ${s.meta.articleLen} · sitelinks: ${s.meta.sitelinks}`,
    );
  }
  lines.push('');

  // Top-10 lowest-scoring keeps (the floor).
  const keeps = scores.filter((s) => !s.drop && !s.meta.notFound);
  const keepsSorted = [...keeps].sort((a, b) => a.meta.pageviews - b.meta.pageviews);
  lines.push('## Top-10 lowest-scoring keeps (the floor)');
  lines.push('');
  for (const s of keepsSorted.slice(0, 10)) {
    lines.push(
      `- **${s.bucket}** \`${s.entry.name}\` — pageviews: ${s.meta.pageviews} · article_len: ${s.meta.articleLen} · sitelinks: ${s.meta.sitelinks}`,
    );
  }
  lines.push('');

  // Removals by pair.
  lines.push('## All removals');
  lines.push('');
  const byPair = new Map<string, FameScore[]>();
  for (const s of removed) {
    const arr = byPair.get(s.bucket) ?? [];
    arr.push(s);
    byPair.set(s.bucket, arr);
  }
  for (const bucket of [...byPair.keys()].sort()) {
    lines.push(`### ${bucket}`);
    for (const s of byPair.get(bucket)!) {
      lines.push(
        `- \`${s.entry.name}\` — pageviews: ${s.meta.pageviews} · article_len: ${s.meta.articleLen} · sitelinks: ${s.meta.sitelinks}`,
      );
    }
    lines.push('');
  }

  if (emptyPairs.length > 0) {
    lines.push('## Pairs left empty after the prune');
    lines.push('');
    lines.push(emptyPairs.join(', '));
    lines.push('');
  }

  fs.writeFileSync(FAME_LOG, lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Main

interface CliArgs {
  pass: 'structural' | 'fame' | 'both';
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let pass: CliArgs['pass'] = 'both';
  let dryRun = false;
  for (const a of argv) {
    if (a === '--pass=structural') pass = 'structural';
    else if (a === '--pass=fame') pass = 'fame';
    else if (a === '--pass=both') pass = 'both';
    else if (a === '--dry-run') dryRun = true;
  }
  return { pass, dryRun };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const raw = fs.readFileSync(TARGET, 'utf8');
  const parsed = parseFile(raw);

  process.stderr.write(`Loaded ${parsed.pairs.size} pairs from ${path.relative(ROOT, TARGET)}\n`);

  if (args.pass === 'structural' || args.pass === 'both') {
    process.stderr.write('Running structural pass...\n');
    const { decisions, beforeCount, afterCount } = await runStructuralPass(parsed);
    writeStructuralLog(decisions, beforeCount, afterCount);
    process.stderr.write(
      `Structural pass: ${decisions.length} decisions (${beforeCount} → ${afterCount}). Log: ${path.relative(ROOT, STRUCTURAL_LOG)}\n`,
    );
  }

  if (args.pass === 'fame' || args.pass === 'both') {
    process.stderr.write('Running fame pass...\n');
    const { scores, removed, beforeCount, afterCount, emptyPairs } = await runFamePass(parsed);
    writeFameLog(scores, removed, beforeCount, afterCount, emptyPairs);
    process.stderr.write(
      `Fame pass: removed ${removed.length} (${beforeCount} → ${afterCount}). Empty pairs: ${emptyPairs.length}. Log: ${path.relative(ROOT, FAME_LOG)}\n`,
    );
  }

  if (!args.dryRun) {
    fs.writeFileSync(TARGET, renderFile(parsed));
    process.stderr.write(`Wrote ${path.relative(ROOT, TARGET)}\n`);
  } else {
    process.stderr.write('Dry run — no files written.\n');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
