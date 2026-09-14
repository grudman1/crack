/// <reference types="node" />
// Production smoke test: every feature that depends on an environment
// variable or an external service, exercised against the deployed site.
//
//   npx tsx scripts/prodSmoke.ts
//   npx tsx scripts/prodSmoke.ts --skip-mp     (no multiplayer round-trip)
//
// Written after account deletion shipped as "the last App Store blocker"
// and turned out to have never worked in production: the serverless
// function needs SUPABASE_SERVICE_ROLE_KEY, nobody set it, and nothing
// checked. Everything here is a thing that can be configured correctly
// in the repo and still be broken in the deployment.
//
// Creates a handful of anonymous users and one room, then deletes the
// room. The users cannot be removed without the service-role key.

import { readFileSync } from 'node:fs';
import process from 'node:process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SITE = process.env.CRACK_SITE ?? 'https://crack-black.vercel.app';
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

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
const env = { ...loadEnv('.env.local'), ...loadEnv('.env.vercel.local') };
const SUPA_URL = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL!;
const SUPA_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY!;

type Status = 'PASS' | 'FAIL' | 'WARN' | 'INFO';
const rows: { area: string; check: string; status: Status; detail: string }[] = [];
const add = (area: string, check: string, status: Status, detail: string) =>
  rows.push({ area, check, status, detail });

async function head(url: string, init?: RequestInit) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20_000);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------
// A. the web app itself
// ---------------------------------------------------------------------

async function checkSite() {
  const root = await head(SITE).catch((e) => e as Error);
  if (root instanceof Error) {
    add('site', 'root document', 'FAIL', root.message);
    return;
  }
  add('site', 'root document', root.ok ? 'PASS' : 'FAIL', `HTTP ${root.status}`);

  // vercel.json declares five security headers. They are only real if the
  // edge actually emits them.
  const wanted = [
    'strict-transport-security',
    'x-content-type-options',
    'referrer-policy',
    'x-frame-options',
    'permissions-policy',
  ];
  const missing = wanted.filter((h) => !root.headers.get(h));
  add('site', 'security headers', missing.length ? 'FAIL' : 'PASS',
    missing.length ? `missing: ${missing.join(', ')}` : `all ${wanted.length} present`);

  // Every client route must fall through the SPA rewrite, or a deep link
  // shared into iMessage 404s.
  for (const path of ['/solo', '/mp', '/mp/ABCDEF', '/how', '/privacy', '/terms', '/admin']) {
    const r = await head(SITE + path).catch(() => null);
    add('routes', path, r?.ok ? 'PASS' : 'FAIL', r ? `HTTP ${r.status}` : 'request failed');
  }

  // Referenced by index.html and manifest.webmanifest. A 404 here is an
  // invisible break: the page still renders.
  for (const asset of [
    '/favicon.svg', '/favicon-32x32.png', '/apple-touch-icon.png',
    '/icon-192.png', '/icon-512.png', '/og-image.png', '/manifest.webmanifest',
  ]) {
    const r = await head(SITE + asset).catch(() => null);
    add('assets', asset, r?.ok ? 'PASS' : 'FAIL', r ? `HTTP ${r.status} ${r.headers.get('content-type') ?? ''}` : 'request failed');
  }

  // Universal links are Phase 3, so this is expected to be absent — but
  // the SPA rewrite in vercel.json answers EVERY unmatched path with
  // index.html and a 200, so "it returns 200" proves nothing here. Apple
  // fetches this file and requires application/json; an extensionless
  // file served as text/html silently breaks universal links with no
  // client-side symptom. Assert the content type, not the status.
  const aasa = await head(`${SITE}/.well-known/apple-app-site-association`).catch(() => null);
  const aasaType = aasa?.headers.get('content-type') ?? '';
  const aasaReal = Boolean(aasa?.ok) && aasaType.includes('json');
  add('ios', 'apple-app-site-association',
    aasaReal ? 'PASS' : aasa?.ok ? 'INFO' : 'INFO',
    aasaReal
      ? `HTTP ${aasa!.status} ${aasaType}`
      : aasa?.ok
        ? `absent — the SPA rewrite is answering with ${aasaType || 'html'}; Apple needs application/json (Phase 3)`
        : 'absent (expected until Phase 3)');
}

// ---------------------------------------------------------------------
// B. Supabase
// ---------------------------------------------------------------------

async function anon(name: string): Promise<{ client: SupabaseClient; id: string }> {
  const client = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInAnonymously({ options: { data: { display_name: name } } });
  if (error || !data.user) throw new Error(error?.message ?? 'no user');
  return { client, id: data.user.id };
}

async function checkSupabase() {
  const bare = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
  const rest = await bare.from('rooms').select('code').limit(1);
  add('supabase', 'REST reachable with anon key', rest.error ? 'FAIL' : 'PASS',
    rest.error ? rest.error.message : 'rooms readable');

  // The whole multiplayer identity model depends on this toggle being on
  // in the dashboard. It is not in the repo, so it can be switched off
  // without any code change.
  try {
    const a = await anon('smoke-a');
    add('supabase', 'anonymous sign-in enabled', 'PASS', `user ${a.id.slice(0, 8)}…`);
    return a;
  } catch (e) {
    add('supabase', 'anonymous sign-in enabled', 'FAIL', (e as Error).message);
    return null;
  }
}

// Every SECURITY DEFINER function the migrations define. A missing entry
// means a migration did not apply to this environment — which is exactly
// how finalize_round went absent from production for months: two files
// shared a `0006` prefix, the version is derived from that prefix, and
// one of them was silently skipped. Guarded arguments mean a "permission
// denied" or a raised exception both prove the function is present.
const EXPECTED_RPCS: [string, Record<string, unknown>][] = [
  ['finalize_round', { p_room_id: ZERO_UUID }],
  ['compute_room_scores', { p_room_id: ZERO_UUID }],
  ['start_round', { p_room_id: ZERO_UUID, p_sentence: '', p_letters: '' }],
  ['advance_phase_if_expired', { p_room_id: ZERO_UUID }],
  ['reset_room_for_new_round', { p_room_id: ZERO_UUID, p_sentence: '', p_letters: '', p_timer_seconds: 180 }],
  ['is_room_member', { p_room_id: ZERO_UUID }],
  ['shares_room_with', { p_other: ZERO_UUID }],
  ['find_room_by_code', { p_code: 'ZZZZZZ' }],
];

async function checkRpcInventory(client: SupabaseClient) {
  for (const [fn, args] of EXPECTED_RPCS) {
    const { error } = await client.rpc(fn, args);
    // PGRST202 is the only error that means "no such function". Anything
    // else — a guard raising, a permission revoke — means it is there.
    const missing = error?.code === 'PGRST202';
    add('schema', `rpc ${fn}`, missing ? 'FAIL' : 'PASS',
      missing ? 'MISSING — a migration did not apply to this environment' : 'present');
  }
}

async function checkRealtime(client: SupabaseClient) {
  // Realtime is a separate service from PostgREST and fails separately.
  // Multiplayer is unplayable without it — no phase changes, no live
  // submission counts, no scores.
  const ok = await new Promise<string>((resolve) => {
    const timer = setTimeout(() => resolve('TIMEOUT after 15s'), 15_000);
    const ch = client
      .channel('smoke:realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {})
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timer);
          void client.removeChannel(ch);
          resolve(status);
        }
      });
  });
  add('supabase', 'realtime websocket', ok === 'SUBSCRIBED' ? 'PASS' : 'FAIL', ok);
}

// ---------------------------------------------------------------------
// C. serverless functions
// ---------------------------------------------------------------------

async function checkDeleteAccount(token: string) {
  // CORS matters for the iOS build: from capacitor://localhost or
  // https://localhost the Authorization header forces a preflight.
  const pre = await head(`${SITE}/api/delete-account`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://localhost', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization' },
  }).catch(() => null);
  const allowOrigin = pre?.headers.get('access-control-allow-origin');
  add('api', 'delete-account CORS preflight', pre && pre.status < 300 && allowOrigin ? 'PASS' : 'FAIL',
    pre ? `HTTP ${pre.status}, allow-origin: ${allowOrigin ?? 'none'}` : 'request failed');

  const res = await head(`${SITE}/api/delete-account`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
  if (!res) {
    add('api', 'delete-account POST', 'FAIL', 'request failed');
    return;
  }
  const body = await res.text().catch(() => '');
  add('api', 'delete-account POST (Apple 5.1.1(v))',
    res.status === 204 ? 'PASS' : 'FAIL',
    `HTTP ${res.status} ${body.slice(0, 80)}`);
}

// ---------------------------------------------------------------------
// D. external services the validator depends on
// ---------------------------------------------------------------------

async function checkWikimedia() {
  const probes: [string, string, (j: unknown) => boolean][] = [
    ['page summary (validator stage b)',
      'https://en.wikipedia.org/api/rest_v1/page/summary/Alan%20Turing',
      (j) => (j as { title?: string }).title === 'Alan Turing'],
    ['opensearch (stages c/e)',
      'https://en.wikipedia.org/w/api.php?action=opensearch&search=Alan%20Turing&limit=10&format=json&origin=*',
      (j) => Array.isArray(j) && Array.isArray((j as unknown[])[1])],
    ['wikidata entity (person check)',
      'https://www.wikidata.org/wiki/Special:EntityData/Q7251.json',
      (j) => Boolean((j as { entities?: Record<string, unknown> }).entities?.Q7251)],
    ['wikitext revisions (disambig stage d)',
      'https://en.wikipedia.org/w/api.php?action=query&prop=revisions&titles=Chris%20Evans&rvprop=content&rvslots=main&formatversion=2&format=json&origin=*&redirects=1',
      (j) => Boolean((j as { query?: unknown }).query)],
  ];
  for (const [label, url, valid] of probes) {
    try {
      const r = await head(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) {
        add('wikimedia', label, 'FAIL', `HTTP ${r.status}`);
        continue;
      }
      const j = (await r.json()) as unknown;
      add('wikimedia', label, valid(j) ? 'PASS' : 'FAIL', valid(j) ? 'shape ok' : 'unexpected response shape');
    } catch (e) {
      add('wikimedia', label, 'FAIL', (e as Error).message);
    }
  }
}

async function checkSentry() {
  const dsn = env.VITE_SENTRY_DSN;
  if (!dsn) {
    add('sentry', 'DSN configured locally', 'INFO', 'not in .env.local; check Vercel');
    return;
  }
  const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
  if (!m) {
    add('sentry', 'DSN well-formed', 'FAIL', 'does not parse');
    return;
  }
  // Hit the envelope endpoint without a payload: 400 means the project
  // exists and is accepting, 404/403 means the DSN is stale.
  const r = await head(`https://${m[2]}/api/${m[3]}/envelope/`, { method: 'POST', body: '' }).catch(() => null);
  add('sentry', 'ingest endpoint reachable', r && r.status !== 404 && r.status !== 403 ? 'PASS' : 'WARN',
    r ? `HTTP ${r.status} (project ${m[3]})` : 'request failed');

  // Whether the deployed bundle actually initialises Sentry is separate:
  // main.tsx only calls Sentry.init when VITE_SENTRY_DSN is set at BUILD
  // time, so a var added after the last deploy does nothing.
  const bundle = await head(SITE).then((r) => r.text()).catch(() => '');
  const asset = bundle.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/)?.[1];
  if (asset) {
    const js = await head(`${SITE}/assets/${asset}`).then((r) => r.text()).catch(() => '');
    const baked = js.includes('ingest.us.sentry.io') || js.includes('ingest.sentry.io');
    add('sentry', 'DSN baked into the deployed bundle', baked ? 'PASS' : 'WARN',
      baked ? 'present in shipped JS' : 'absent — Sentry is a no-op in production');
  }
}

// ---------------------------------------------------------------------
// E. multiplayer round-trip — the flow App Review will walk
// ---------------------------------------------------------------------

async function checkMultiplayer(host: { client: SupabaseClient; id: string }) {
  let roomId: string | null = null;
  try {
    const guest = await anon('smoke-b');

    const code = `S${Math.floor(Math.random() * 90000 + 10000)}`;
    const mk = await host.client
      .from('rooms')
      .insert({ code, host_id: host.id, timer_seconds: 180, phase: 'lobby' })
      .select()
      .single();
    if (mk.error) throw new Error(`create room: ${mk.error.message}`);
    roomId = (mk.data as { id: string }).id;
    add('multiplayer', 'create room', 'PASS', `code ${code}`);

    for (const [who, p] of [['host', host], ['guest', guest]] as const) {
      const j = await p.client.from('room_players').insert({ room_id: roomId, player_id: p.id });
      add('multiplayer', `${who} joins lobby`, j.error ? 'FAIL' : 'PASS', j.error?.message ?? 'joined');
    }

    const start = await host.client.rpc('start_round', {
      p_room_id: roomId, p_sentence: '{}', p_letters: 'A'.repeat(26),
    });
    add('multiplayer', 'start_round RPC (host-guarded)', start.error ? 'FAIL' : 'PASS', start.error?.message ?? 'phase -> playing');

    for (const [who, p] of [['host', host], ['guest', guest]] as const) {
      const s = await p.client.from('submissions').insert({
        room_id: roomId, player_id: p.id, row_index: 0, initials: 'AT', name: 'Alan Turing',
      });
      add('multiplayer', `${who} submits an answer`, s.error ? 'FAIL' : 'PASS', s.error?.message ?? 'written');
    }

    // The client normally waits for the timer; force the transition the
    // same way the server would.
    await host.client.from('rooms').update({ phase: 'validating' }).eq('id', roomId);

    const subs = await guest.client.from('submissions').select('id, player_id').eq('room_id', roomId);
    add('multiplayer', 'guest reads answers in validating', subs.error ? 'FAIL' : 'PASS',
      subs.error?.message ?? `${subs.data?.length ?? 0} submission(s) visible`);

    const hostSub = (subs.data ?? []).find((s) => s.player_id === host.id);
    if (hostSub) {
      const v = await guest.client.from('votes').insert({
        room_id: roomId, submission_id: hostSub.id, voter_id: guest.id, is_valid: true,
      });
      add('multiplayer', 'guest votes on host answer', v.error ? 'FAIL' : 'PASS', v.error?.message ?? 'vote cast');
    }

    const fin = await host.client.rpc('finalize_round', { p_room_id: roomId });
    add('multiplayer', 'finalize_round RPC (scoring)', fin.error ? 'FAIL' : 'PASS', fin.error?.message ?? 'scores computed');

    const scores = await host.client.from('scores').select('player_id, total').eq('room_id', roomId);
    add('multiplayer', 'scores readable by members', scores.error ? 'FAIL' : 'PASS',
      scores.error?.message ?? `${scores.data?.length ?? 0} row(s): ${(scores.data ?? []).map((s) => s.total).join(', ')}`);

    const reset = await host.client.rpc('reset_room_for_new_round', {
      p_room_id: roomId, p_sentence: '{}', p_letters: 'B'.repeat(26), p_timer_seconds: 180,
    });
    add('multiplayer', 'reset_room_for_new_round RPC', reset.error ? 'FAIL' : 'PASS', reset.error?.message ?? 'back to lobby');
  } catch (e) {
    add('multiplayer', 'round-trip', 'FAIL', (e as Error).message);
  } finally {
    if (roomId) await host.client.from('rooms').delete().eq('id', roomId);
  }
}

// ---------------------------------------------------------------------

const main = async () => {
  console.log(`production smoke test\n  site:     ${SITE}\n  supabase: ${SUPA_URL}\n`);

  await checkSite();
  const first = await checkSupabase();
  if (first) {
    await checkRpcInventory(first.client);
    await checkRealtime(first.client);
    const { data } = await first.client.auth.getSession();
    if (data.session) await checkDeleteAccount(data.session.access_token);
    if (!process.argv.includes('--skip-mp')) await checkMultiplayer(first);
  }
  await checkWikimedia();
  await checkSentry();

  const pad = (s: string, n: number) => s.padEnd(n);
  const icon = { PASS: '  ok ', FAIL: 'FAIL ', WARN: 'warn ', INFO: ' --  ' } as const;
  console.log(pad('', 5), pad('area', 13), pad('check', 42), 'detail');
  console.log('-'.repeat(125));
  for (const r of rows) console.log(icon[r.status], pad(r.area, 13), pad(r.check, 42), r.detail);

  const fails = rows.filter((r) => r.status === 'FAIL');
  const warns = rows.filter((r) => r.status === 'WARN');
  console.log(`\n${rows.filter((r) => r.status === 'PASS').length} passed, ${fails.length} failed, ${warns.length} warnings`);
  if (fails.length) {
    console.log('\nFAILURES:');
    for (const f of fails) console.log(`  ${f.area}/${f.check}: ${f.detail}`);
    process.exitCode = 1;
  }
};

await main();
