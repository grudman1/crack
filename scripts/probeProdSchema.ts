// Read-only probe of the production Supabase schema using the public
// anon key. Answers one question: which migrations actually landed?
//
// The repo has two files with the same `0006` prefix, which makes the
// Supabase CLI's migration runner fail with a duplicate-key error on
// supabase_migrations.schema_migrations. If the GitHub integration hit
// the same conflict, production's schema may be behind the repo — and a
// new migration might not apply at all.
//
// Usage: npx tsx scripts/probeProdSchema.ts
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.local.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(path = '.env.local'): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL!;
const anon = env.VITE_SUPABASE_ANON_KEY!;
const sb = createClient(url, anon, { auth: { persistSession: false } });

type Probe = { migration: string; what: string; run: () => Promise<'present' | 'absent' | string> };

const missingColumn = (e: { code?: string; message?: string } | null) =>
  e?.code === '42703' || /column .* does not exist/i.test(e?.message ?? '');
const missingFn = (e: { code?: string; message?: string } | null) =>
  e?.code === 'PGRST202' || /could not find the function/i.test(e?.message ?? '');

const probes: Probe[] = [
  {
    migration: '0001',
    what: 'rooms table + compute_room_scores',
    run: async () => {
      const { error } = await sb.from('rooms').select('code').limit(1);
      return error ? `ERROR ${error.code}: ${error.message}` : 'present';
    },
  },
  {
    migration: '0002',
    what: 'profiles.is_admin column',
    run: async () => {
      const { error } = await sb.from('profiles').select('is_admin').limit(1);
      if (!error) return 'present';
      return missingColumn(error) ? 'absent' : `ERROR ${error.code}: ${error.message}`;
    },
  },
  {
    migration: '0002',
    what: 'validation_reviews table',
    run: async () => {
      const { error } = await sb.from('validation_reviews').select('id').limit(1);
      if (!error) return 'present';
      return /does not exist|schema cache/i.test(error.message) ? 'absent' : `ERROR ${error.code}: ${error.message}`;
    },
  },
  {
    migration: '0004',
    what: 'is_room_member() function',
    run: async () => {
      const { error } = await sb.rpc('is_room_member', {
        p_room_id: '00000000-0000-0000-0000-000000000000',
      });
      if (!error) return 'present';
      return missingFn(error) ? 'absent' : `present (errored: ${error.message})`;
    },
  },
  {
    migration: '0004',
    what: 'reset_room_for_new_round() function',
    run: async () => {
      const { error } = await sb.rpc('reset_room_for_new_round', {
        p_room_id: '00000000-0000-0000-0000-000000000000',
        p_sentence: '',
        p_letters: '',
        p_timer_seconds: 180,
      });
      if (!error) return 'present';
      return missingFn(error) ? 'absent' : `present (errored: ${error.message})`;
    },
  },
  {
    migration: '0005',
    what: 'rooms.play_started_at column',
    run: async () => {
      const { error } = await sb.from('rooms').select('play_started_at').limit(1);
      if (!error) return 'present';
      return missingColumn(error) ? 'absent' : `ERROR ${error.code}: ${error.message}`;
    },
  },
  {
    migration: '0005',
    what: 'start_round() function',
    run: async () => {
      const { error } = await sb.rpc('start_round', {
        p_room_id: '00000000-0000-0000-0000-000000000000',
        p_sentence: '',
        p_letters: '',
      });
      if (!error) return 'present';
      return missingFn(error) ? 'absent' : `present (errored: ${error.message})`;
    },
  },
  {
    migration: '0005',
    what: 'advance_phase_if_expired() function',
    run: async () => {
      const { error } = await sb.rpc('advance_phase_if_expired', {
        p_room_id: '00000000-0000-0000-0000-000000000000',
      });
      if (!error) return 'present';
      return missingFn(error) ? 'absent' : `present (errored: ${error.message})`;
    },
  },
  {
    migration: '0006_finalize',
    what: 'finalize_round() function',
    run: async () => {
      const { error } = await sb.rpc('finalize_round', {
        p_room_id: '00000000-0000-0000-0000-000000000000',
      });
      if (!error) return 'present';
      return missingFn(error) ? 'absent' : `present (errored: ${error.message})`;
    },
  },
  {
    migration: '0006_finalize',
    what: 'compute_room_scores REVOKEd from clients',
    run: async () => {
      const { error } = await sb.rpc('compute_room_scores', {
        p_room_id: '00000000-0000-0000-0000-000000000000',
      });
      if (!error) return 'NOT REVOKED — callable by anon';
      if (/permission denied/i.test(error.message)) return 'revoked (present)';
      return missingFn(error) ? 'absent' : `present (errored: ${error.message})`;
    },
  },
  {
    migration: '0008 (new)',
    what: 'find_room_by_code() — expected ABSENT before this ships',
    run: async () => {
      const { error } = await sb.rpc('find_room_by_code', { p_code: 'ZZZZZZ' });
      if (!error) return 'present';
      return missingFn(error) ? 'absent' : `present (errored: ${error.message})`;
    },
  },
];

const results: string[] = [];
for (const p of probes) {
  let r: string;
  try {
    r = await p.run();
  } catch (e) {
    r = `THREW ${(e as Error).message}`;
  }
  results.push(`${p.migration.padEnd(16)} ${p.what.padEnd(52)} ${r}`);
}

console.log('PRODUCTION SCHEMA PROBE');
console.log('url:', url);
console.log('');
console.log('migration'.padEnd(16), 'check'.padEnd(52), 'result');
console.log('-'.repeat(110));
for (const r of results) console.log(r);

// The 0006_revert question: does an UNAUTHENTICATED caller see rooms?
// 0005 tightened rooms SELECT to authenticated-only; 0006_revert put it
// back to `using (true)`. If the revert never applied, an anonymous
// (unauthenticated) select returns zero rows even when rooms exist.
const { count, error: cErr } = await sb
  .from('rooms')
  .select('*', { count: 'exact', head: true });
console.log('');
console.log('rooms SELECT as UNAUTHENTICATED caller:', cErr ? `ERROR ${cErr.message}` : `${count} row(s) visible`);
console.log(
  count && count > 0
    ? '  -> `rooms read all using (true)` is in effect (0006_revert applied)'
    : '  -> zero rows: either no rooms exist, or 0006_revert did NOT apply',
);
