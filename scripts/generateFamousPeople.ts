/**
 * generateFamousPeople.ts
 *
 * Build-time pipeline that produces src/data/famousPeople.ts — a curated map of
 * initial pairs ("AA" … "ZZ") to ~20 recognisable famous people each.
 *
 * Pipeline per pair:
 *   1. Query Wikidata SPARQL for humans whose name starts with the given
 *      initials. Filter to >=5 Wikipedia sitelinks (a fame proxy).
 *   2. Send the candidate list to Claude (Anthropic API). Claude reranks by
 *      "would a normal person at a family gathering recognise this name?" and
 *      returns up to N entries.
 *   3. HEAD-check each returned Wikipedia article exists (drop 404s).
 *   4. Write the running map to disk after every pair (crash-resilient).
 *
 * Why this exists: at runtime, src/services/soloSuggestions.ts is a static
 * lookup against this file. No live Wikipedia or Anthropic calls in the
 * shipped app. See PROJECT_BRIEF (Step 1) for the full rationale.
 *
 * Cost expectation: ~$15-20 in Anthropic API usage for a full 676-pair run.
 *
 * Usage:
 *   npm run gen-people                         # full run
 *   npm run gen-people -- --pairs=BA,EL,JE     # subset
 *   npm run gen-people -- --limit=10           # names per pair (default 20)
 *   npm run gen-people -- --out=...            # output path
 *   npm run gen-people -- --no-skip-existing   # regenerate every pair
 *
 * Requirements:
 *   ANTHROPIC_API_KEY in .env.local (loaded by tsx via --env-file or manually)
 *
 * NOTE: The Anthropic SDK reads ANTHROPIC_API_KEY from process.env directly.
 *       If your key lives in .env.local, run with:
 *         node --env-file=.env.local node_modules/.bin/tsx scripts/...
 *       or export it in your shell before invoking npm run gen-people.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';

// ---------------------------------------------------------------------------
// Types

interface CliOptions {
  pairs: string[] | null; // null = all 676
  limit: number;
  out: string;
  skipExisting: boolean;
}

interface WikidataCandidate {
  qid: string;
  name: string;
  description: string | null;
  sitelinks: number;
  slug: string;
}

interface ClaudePick {
  name: string;
  description: string;
  wikipediaSlug: string;
}

interface Suggestion {
  name: string;
  description?: string;
  wikipediaUrl?: string;
}

type Dataset = Record<string, Suggestion[]>;

// ---------------------------------------------------------------------------
// Config

const DEFAULT_OUT = 'src/data/famousPeople.ts';
const DEFAULT_LIMIT = 20;
const SPARQL_THROTTLE_MS = 1100; // ~1 req/sec for the public endpoint
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2000;

const SYSTEM_PROMPT = `You are curating a list of famous people for a family party game called CRACK.

Players are given two-letter initials and must name a famous person whose first and last initials match. The "Famous folks you missed" panel shows suggestions from this list when a player misses a row.

For each request, you'll receive a two-letter initial pair, a target count, and a list of candidates from Wikidata. Candidates are real people whose names match the pair, ordered by how many language Wikipedias have an article on them (higher = more globally documented).

Pick the top N most likely to be recognized by an average English-speaking adult at a family gathering. Bias strongly toward colloquial fame over encyclopedic fame: a B-list American actor or a current pop star beats an A-list Romanian Orthodox archbishop with 40 sitelinks. Think actors, musicians, athletes, politicians, business leaders, historical figures with broad cultural reach, infamous figures people still recognize by name.

Exclude: pornographic performers, people primarily notable for being victims of violent crime, fictional characters.

Return ONLY a JSON array (no preamble, no markdown fences):
[{"name": "...", "description": "...", "wikipediaSlug": "..."}]

- "name" must be the person's full name as a player would say it (e.g. "Eva Longoria", not "Eva Jacqueline Longoria Bastón")
- "description" is a 40-80 char phrase from the candidate's description, edited for clarity (e.g. "American actress, b. 1975")
- "wikipediaSlug" is the URL slug from the candidate (e.g. "Eva_Longoria")

If fewer than the requested count meet the recognizability bar, return fewer. Better to return 5 great names than 20 padded with obscurity.`;

// ---------------------------------------------------------------------------
// CLI parsing

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    pairs: null,
    limit: DEFAULT_LIMIT,
    out: DEFAULT_OUT,
    skipExisting: true,
  };
  for (const arg of argv) {
    if (arg.startsWith('--pairs=')) {
      const raw = arg.slice('--pairs='.length).trim();
      opts.pairs = raw
        .split(',')
        .map((p) => p.trim().toUpperCase())
        .filter((p) => /^[A-Z]{2}$/.test(p));
    } else if (arg.startsWith('--limit=')) {
      const n = Number(arg.slice('--limit='.length));
      if (Number.isFinite(n) && n > 0) opts.limit = Math.floor(n);
    } else if (arg.startsWith('--out=')) {
      opts.out = arg.slice('--out='.length);
    } else if (arg === '--skip-existing' || arg === '--skip-existing=true') {
      opts.skipExisting = true;
    } else if (arg === '--no-skip-existing' || arg === '--skip-existing=false') {
      opts.skipExisting = false;
    }
  }
  return opts;
}

function allPairs(): string[] {
  const out: string[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      out.push(String.fromCharCode(a) + String.fromCharCode(b));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Wikidata SPARQL fetch

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildSparql(pair: string): string {
  const [a, b] = [pair[0]!, pair[1]!];
  // Match labels like "<A>... <B>..." — supports "A. B Cccc" and "Aaaa Bbbb"
  // and "Aaaa Mmm Bbbb" via the \\b before the surname initial.
  const regex = `^${a}\\S+\\s+.*\\b${b}\\S*$`;
  return `
SELECT ?person ?personLabel ?personDescription ?sitelinks ?slug WHERE {
  ?person wdt:P31 wd:Q5 .
  ?person rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  FILTER(REGEX(?label, "${regex}", "i"))
  ?person wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 5)
  ?article schema:about ?person ;
           schema:isPartOf <https://en.wikipedia.org/> ;
           schema:name ?slug .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY DESC(?sitelinks)
LIMIT 50`;
}

interface SparqlBinding {
  person?: { value: string };
  personLabel?: { value: string };
  personDescription?: { value: string };
  sitelinks?: { value: string };
  slug?: { value: string };
}

interface SparqlResponse {
  results?: { bindings?: SparqlBinding[] };
}

async function fetchCandidates(pair: string): Promise<WikidataCandidate[]> {
  const query = buildSparql(pair);
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/sparql-results+json',
          'User-Agent': 'CRACK-name-game-generator/1.0 (https://example.com)',
        },
      });
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          await sleep(3000 + Math.random() * 2000);
          continue;
        }
        return [];
      }
      const data = (await res.json()) as SparqlResponse;
      const bindings = data.results?.bindings ?? [];
      const out: WikidataCandidate[] = [];
      for (const b of bindings) {
        const qid = b.person?.value?.split('/').pop();
        const name = b.personLabel?.value;
        const slug = b.slug?.value?.split('/').pop();
        const sitelinks = Number(b.sitelinks?.value ?? '0');
        if (!qid || !name || !slug || !Number.isFinite(sitelinks)) continue;
        out.push({
          qid,
          name,
          description: b.personDescription?.value ?? null,
          sitelinks,
          slug: decodeURIComponent(slug),
        });
      }
      return out;
    } catch {
      await sleep(2000);
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Claude rerank

const client = new Anthropic();

async function rerankWithClaude(
  pair: string,
  candidates: WikidataCandidate[],
  limit: number,
): Promise<ClaudePick[]> {
  if (candidates.length === 0) return [];

  const userText = [
    `Initials: ${pair}`,
    `Target count: ${limit}`,
    `Candidates (${candidates.length}):`,
    JSON.stringify(
      candidates.map((c) => ({
        name: c.name,
        description: c.description,
        sitelinks: c.sitelinks,
        wikipediaSlug: c.slug,
      })),
      null,
      2,
    ),
  ].join('\n');

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        thinking: { type: 'adaptive' },
        messages: [
          {
            role: 'user',
            content:
              attempt === 0
                ? userText
                : `${userText}\n\nIMPORTANT: respond with ONLY the JSON array. No markdown fences, no preamble.`,
          },
        ],
      });

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      const picks = parsePicks(text);
      if (picks.length > 0) return picks;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  Claude attempt ${attempt + 1} failed: ${msg}`);
      await sleep(2000);
    }
  }
  return [];
}

function parsePicks(text: string): ClaudePick[] {
  // Strip code fences if Claude added them despite instructions.
  let body = text.trim();
  if (body.startsWith('```')) {
    body = body.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  }
  // Find the first '[' and last ']' to be resilient to any wrapping prose.
  const start = body.indexOf('[');
  const end = body.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  const slice = body.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: ClaudePick[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    const description = typeof rec.description === 'string' ? rec.description.trim() : '';
    const wikipediaSlug = typeof rec.wikipediaSlug === 'string' ? rec.wikipediaSlug.trim() : '';
    if (name && wikipediaSlug) out.push({ name, description, wikipediaSlug });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Wikipedia URL validation

async function wikipediaArticleExists(slug: string): Promise<boolean> {
  const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// File IO

function loadExisting(outPath: string): Dataset {
  try {
    const raw = fs.readFileSync(outPath, 'utf8');
    const match = raw.match(/FAMOUS_PEOPLE[^=]*=\s*(\{[\s\S]*\});?\s*$/);
    if (!match || !match[1]) return {};
    // The file is a TS export, but the literal is JSON-shaped — eval safely
    // by extracting only the object literal and parsing as JSON5-ish (we
    // trust this file, since we wrote it).
    const objText = match[1]
      .replace(/(\w+):/g, '"$1":') // quote keys
      .replace(/,(\s*[}\]])/g, '$1'); // strip trailing commas
    const parsed = JSON.parse(objText) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Dataset;
    }
    return {};
  } catch {
    return {};
  }
}

function writeDataset(outPath: string, data: Dataset): void {
  const sortedKeys = Object.keys(data).sort();
  const lines: string[] = [
    '// GENERATED by scripts/generateFamousPeople.ts — do not edit by hand.',
    '// Sources: Wikidata (CC0) for candidate enumeration, Claude for ranking,',
    '// Wikipedia (CC BY-SA) for article URLs and descriptions.',
    '// To regenerate: npm run gen-people',
    '',
    "import type { Suggestion } from '@/services/soloSuggestions';",
    '',
    'export const FAMOUS_PEOPLE: Record<string, Suggestion[]> = {',
  ];
  for (const k of sortedKeys) {
    const arr = data[k] ?? [];
    if (arr.length === 0) {
      lines.push(`  ${k}: [],`);
      continue;
    }
    lines.push(`  ${k}: [`);
    for (const s of arr) {
      const parts: string[] = [`name: ${JSON.stringify(s.name)}`];
      if (s.description) parts.push(`description: ${JSON.stringify(s.description)}`);
      if (s.wikipediaUrl) parts.push(`wikipediaUrl: ${JSON.stringify(s.wikipediaUrl)}`);
      lines.push(`    { ${parts.join(', ')} },`);
    }
    lines.push('  ],');
  }
  lines.push('};');
  lines.push('');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Main

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const targets = opts.pairs ?? allPairs();
  const outPath = path.resolve(process.cwd(), opts.out);
  const data = opts.skipExisting ? loadExisting(outPath) : {};

  console.log(`Generating ${targets.length} pair(s) → ${opts.out}`);
  console.log(`  limit per pair: ${opts.limit}`);
  console.log(`  skip existing : ${opts.skipExisting}`);
  console.log(`  model         : ${MODEL}`);

  let done = 0;
  for (const pair of targets) {
    done += 1;
    if (opts.skipExisting && Array.isArray(data[pair]) && (data[pair]?.length ?? 0) > 0) {
      console.log(`[${done}/${targets.length}] ${pair} — skipped (existing ${data[pair]?.length})`);
      continue;
    }
    process.stdout.write(`[${done}/${targets.length}] ${pair} — fetching... `);
    const candidates = await fetchCandidates(pair);
    process.stdout.write(`${candidates.length} candidates; `);
    await sleep(SPARQL_THROTTLE_MS);

    if (candidates.length === 0) {
      data[pair] = [];
      writeDataset(outPath, data);
      console.log('empty.');
      continue;
    }

    const picks = await rerankWithClaude(pair, candidates.slice(0, 50), opts.limit);
    process.stdout.write(`Claude picked ${picks.length}; `);

    const verified: Suggestion[] = [];
    for (const p of picks) {
      const ok = await wikipediaArticleExists(p.wikipediaSlug);
      if (ok) {
        verified.push({
          name: p.name,
          description: p.description || undefined,
          wikipediaUrl: `https://en.wikipedia.org/wiki/${p.wikipediaSlug}`,
        });
      }
    }
    data[pair] = verified;
    writeDataset(outPath, data);
    console.log(`wrote ${verified.length}.`);
  }
  console.log('Done.');
}

void main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
