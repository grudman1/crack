// Snapshot public.validation_reviews to a file in the repo.
//
// This table is the only genuinely irreplaceable data in the project.
// Rooms, submissions, votes and scores are all ephemeral — a round ends
// and they stop mattering. The review queue is the accumulated record of
// every case where the validator disagreed with a human, which is what
// the regression set and the FAMOUS_PEOPLE curation are built from. It
// cannot be regenerated.
//
//   npx tsx scripts/exportReviews.ts            -> data/validation-reviews.json
//   npx tsx scripts/exportReviews.ts --count    -> row count only, writes nothing
//   npx tsx scripts/exportReviews.ts --out path
//
// Needs SUPABASE_SERVICE_ROLE_KEY, because RLS deliberately scopes reads
// to the row's author or an admin (see 0008). Read it from the
// environment or a gitignored .env.local; never pass it on the command
// line, where it lands in shell history.
//
// Privacy note: rows carry anonymous player ids and free-text
// user_comment written by players. --redact drops user_comment and
// client_fingerprint if you would rather not have player-written text in
// git history permanently.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

function loadEnv(path: string): Record<string, string> {
  try {
    const out: Record<string, string> = {};
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim();
    }
    return out;
  } catch {
    return {};
  }
}

const fileEnv = { ...loadEnv('.env.local'), ...loadEnv('.env.vercel.local') };
const pick = (k: string) => process.env[k] ?? fileEnv[k];

const url = pick('VITE_SUPABASE_URL') ?? pick('SUPABASE_URL');
const serviceKey = pick('SUPABASE_SERVICE_ROLE_KEY');

if (!url) {
  console.error('No Supabase URL. Set VITE_SUPABASE_URL in .env.local or the environment.');
  process.exit(1);
}
if (!serviceKey) {
  console.error(
    [
      'No SUPABASE_SERVICE_ROLE_KEY.',
      '',
      'RLS scopes validation_reviews reads to the row author or an admin, so the',
      'publishable anon key cannot see the table. Two ways to supply it:',
      '',
      '  1. Add it to Vercel (it is also required by api/delete-account.ts, which',
      '     currently returns 500 "Server misconfigured" in production), then:',
      '       vercel env pull .env.vercel.local --environment production \\',
      '         --scope gavin-rudmans-projects',
      '',
      '  2. Export it for one command only:',
      '       SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/exportReviews.ts',
      '',
      'Find it in Supabase -> Project Settings -> API -> service_role.',
    ].join('\n'),
  );
  process.exit(1);
}

const COUNT_ONLY = process.argv.includes('--count');
const REDACT = process.argv.includes('--redact');
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx >= 0 ? process.argv[outIdx + 1]! : 'data/validation-reviews.json';

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { count, error: countErr } = await admin
  .from('validation_reviews')
  .select('*', { count: 'exact', head: true });

if (countErr) {
  console.error(`Could not read validation_reviews: ${countErr.message}`);
  process.exit(1);
}

console.log(`validation_reviews: ${count} row(s)`);

// Status breakdown is the useful shape — it says how much of the queue
// has actually been triaged.
for (const status of ['pending', 'approved', 'rejected', 'duplicate'] as const) {
  const { count: c } = await admin
    .from('validation_reviews')
    .select('*', { count: 'exact', head: true })
    .eq('status', status);
  console.log(`  ${status.padEnd(10)} ${c}`);
}

if (COUNT_ONLY) process.exit(0);

// Page through rather than trusting a single request: PostgREST caps
// response size, and this table grows without bound.
const PAGE = 500;
type Row = Record<string, unknown>;
const rows: Row[] = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await admin
    .from('validation_reviews')
    .select('*')
    .order('created_at', { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) {
    console.error(`Read failed at offset ${from}: ${error.message}`);
    process.exit(1);
  }
  if (!data?.length) break;
  rows.push(...(data as Row[]));
  if (data.length < PAGE) break;
}

// Omit by deletion rather than by destructuring-and-discarding: the
// latter needs two throwaway bindings that the lint config rejects.
const REDACTED_FIELDS = ['user_comment', 'client_fingerprint'] as const;
const cleaned = REDACT
  ? rows.map((row) => {
      const copy = { ...row };
      for (const field of REDACTED_FIELDS) delete copy[field];
      return copy;
    })
  : rows;

const payload = {
  table: 'public.validation_reviews',
  exported_at: new Date().toISOString(),
  source: url,
  row_count: cleaned.length,
  redacted: REDACT,
  rows: cleaned,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);

const bytes = Buffer.byteLength(JSON.stringify(payload));
console.log(`\nWrote ${cleaned.length} row(s) to ${OUT} (${(bytes / 1024).toFixed(1)} kB)${REDACT ? ', redacted' : ''}`);
if (!REDACT) {
  console.log('Contains player-written user_comment text. Re-run with --redact to drop it.');
}
