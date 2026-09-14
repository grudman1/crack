// Hostile-client probe against a DEPLOYED Supabase project, using only
// the publishable anon key — i.e. exactly what ships in the web bundle
// and will ship in the iOS binary.
//
// This is the production counterpart to tests/rls/rls.test.ts, which
// runs the same threat model against a local stack. Run it after any
// migration that touches RLS.
//
//   npx tsx scripts/verifyProdRls.ts            # read-only checks only
//   npx tsx scripts/verifyProdRls.ts --full     # includes state-changing attacks
//
// --full is safe ONLY once 0008 is applied: every attack it runs is
// expected to be rejected, so nothing is written. It self-guards anyway
// — if the privilege escalation succeeds it reverts immediately and
// exits non-zero.
//
// Cost: creates up to two anonymous users, the same thing every
// multiplayer player does. They cannot be cleaned up without the
// service-role key.

import { readFileSync } from 'node:fs';
import process from 'node:process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function loadEnv(path = '.env.local'): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

const env = loadEnv();
const URL = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL!;
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY!;
const FULL = process.argv.includes('--full');

const results: { id: string; what: string; verdict: 'BLOCKED' | 'EXPLOITABLE' | 'INFO'; detail: string }[] = [];
const record = (id: string, what: string, verdict: 'BLOCKED' | 'EXPLOITABLE' | 'INFO', detail: string) =>
  results.push({ id, what, verdict, detail });

async function anonClient(name: string): Promise<{ client: SupabaseClient; id: string }> {
  const client = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInAnonymously({ options: { data: { display_name: name } } });
  if (error || !data.user) throw new Error(`anonymous sign-in failed: ${error?.message}`);
  return { client, id: data.user.id };
}

const main = async () => {
  console.log(`hostile-client probe against ${URL}`);
  console.log(`mode: ${FULL ? 'FULL (state-changing attacks included)' : 'read-only'}\n`);

  // --- schema survival -------------------------------------------------
  const bare = createClient(URL, KEY, { auth: { persistSession: false } });
  const rev = await bare.from('validation_reviews').select('id').limit(1);
  record(
    'schema',
    'validation_reviews table reachable',
    rev.error && /does not exist|schema cache/i.test(rev.error.message) ? 'EXPLOITABLE' : 'INFO',
    rev.error ? `error: ${rev.error.message}` : `reachable; ${rev.data?.length ?? 0} row(s) visible to an unauthenticated caller (RLS scopes reads to the author, so 0 is expected)`,
  );

  const attacker = await anonClient('probe-attacker');

  // --- S2: profile enumeration (read-only) -----------------------------
  const prof = await attacker.client.from('profiles').select('id, is_admin');
  const rows = prof.data ?? [];
  const others = rows.filter((r) => r.id !== attacker.id);
  record(
    'S2',
    'profile enumeration',
    others.length > 0 ? 'EXPLOITABLE' : 'BLOCKED',
    others.length > 0
      ? `saw ${rows.length} profiles (${others.length} not mine, ${rows.filter((r) => r.is_admin).length} admin)`
      : `saw only my own profile`,
  );

  // --- rooms enumeration (read-only; known and accepted) ---------------
  const roomsHead = await bare.from('rooms').select('*', { count: 'exact', head: true });
  record(
    'known',
    'rooms enumeration (accepted, not fixed by 0008)',
    'INFO',
    roomsHead.error ? `error: ${roomsHead.error.message}` : `${roomsHead.count} room(s) listable without a session`,
  );

  if (!FULL) {
    report();
    return;
  }

  // --- S1: privilege escalation ---------------------------------------
  const esc = await attacker.client.from('profiles').update({ is_admin: true }).eq('id', attacker.id);
  const after = await attacker.client.from('profiles').select('is_admin').eq('id', attacker.id).maybeSingle();
  const escalated = after.data?.is_admin === true;
  if (escalated) {
    // Undo immediately — do not leave a privileged account behind.
    await attacker.client.from('profiles').update({ is_admin: false }).eq('id', attacker.id);
    const recheck = await attacker.client.from('profiles').select('is_admin').eq('id', attacker.id).maybeSingle();
    record('S1', 'privilege escalation (is_admin)', 'EXPLOITABLE',
      `ESCALATED. Reverted: is_admin is now ${recheck.data?.is_admin}. ${recheck.data?.is_admin === true ? 'REVERT FAILED — delete user ' + attacker.id + ' manually.' : ''}`);
  } else {
    record('S1', 'privilege escalation (is_admin)', 'BLOCKED', `rejected: ${esc.error?.message ?? 'no row updated'}`);
  }

  // --- legitimate write must still work --------------------------------
  const rename = await attacker.client.from('profiles').update({ display_name: 'Probe' }).eq('id', attacker.id);
  const renamed = await attacker.client.from('profiles').select('display_name').eq('id', attacker.id).maybeSingle();
  record('ok', 'a player can still rename themselves', renamed.data?.display_name === 'Probe' ? 'INFO' : 'EXPLOITABLE',
    renamed.data?.display_name === 'Probe' ? 'display_name updated as expected' : `BROKEN: ${rename.error?.message}`);

  // --- S3: join a room that is not in the lobby ------------------------
  // Uses the attacker's own room so nothing belonging to a real player is
  // touched. The room is created through the normal client path.
  const code = `P${Math.floor(Math.random() * 90000 + 10000)}`;
  const mk = await attacker.client
    .from('rooms')
    .insert({ code, host_id: attacker.id, timer_seconds: 180, phase: 'lobby' })
    .select()
    .single();
  if (mk.error) {
    record('S3', 'mid-phase room join', 'INFO', `could not create a probe room: ${mk.error.message}`);
  } else {
    const roomId = (mk.data as { id: string }).id;
    await attacker.client.from('rooms').update({ phase: 'validating' }).eq('id', roomId);
    const join = await attacker.client
      .from('room_players')
      .insert({ room_id: roomId, player_id: attacker.id });
    record('S3', 'join a room in validating', join.error ? 'BLOCKED' : 'EXPLOITABLE',
      join.error ? `rejected: ${join.error.message}` : 'JOINED a non-lobby room');

    // --- S5: inject a submission into a room -------------------------
    const inject = await attacker.client.from('submissions').insert({
      room_id: roomId, player_id: attacker.id, row_index: 0, initials: 'AT', name: 'Alan Turing',
    });
    record('S5', 'submission injection', inject.error ? 'BLOCKED' : 'EXPLOITABLE',
      inject.error ? `rejected: ${inject.error.message}` : 'INJECTED a submission');

    await attacker.client.from('rooms').delete().eq('id', roomId);
  }

  // --- S6: review spoofing --------------------------------------------
  const victim = await anonClient('probe-victim');
  const spoof = await attacker.client.from('validation_reviews').insert({
    name: 'Probe Spoof', expected_pair: 'PS', actual_result: 'invalid', trace: [], player_id: victim.id,
  });
  record('S6', 'review authorship spoofing', spoof.error ? 'BLOCKED' : 'EXPLOITABLE',
    spoof.error ? `rejected: ${spoof.error.message}` : 'WROTE a review under another user id');

  const forged = await attacker.client.from('validation_reviews').insert({
    name: 'Probe Forged', expected_pair: 'PF', actual_result: 'invalid', trace: [],
    player_id: attacker.id, status: 'approved', resolution_type: 'fix_validator',
  });
  record('S6b', 'pre-resolved review', forged.error ? 'BLOCKED' : 'EXPLOITABLE',
    forged.error ? `rejected: ${forged.error.message}` : 'WROTE a pre-approved review');

  // --- S7: scoring RPC -------------------------------------------------
  const rpc = await attacker.client.rpc('compute_room_scores', {
    p_room_id: '00000000-0000-0000-0000-000000000000',
  });
  record('S7', 'compute_room_scores callable', rpc.error ? 'BLOCKED' : 'EXPLOITABLE',
    rpc.error ? `rejected: ${rpc.error.message}` : 'CALLABLE by a client');

  report();
};

function report() {
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(pad('id', 6), pad('check', 44), pad('verdict', 13), 'detail');
  console.log('-'.repeat(120));
  for (const r of results) console.log(pad(r.id, 6), pad(r.what, 44), pad(r.verdict, 13), r.detail);
  const bad = results.filter((r) => r.verdict === 'EXPLOITABLE');
  console.log('');
  if (bad.length) {
    console.log(`${bad.length} EXPLOITABLE: ${bad.map((b) => b.id).join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('All attack paths blocked.');
  }
}

await main();
