/// <reference types="node" />
// RLS matrix, executed as code against a local Supabase stack.
//
// These are the tests the 2026-09-13 audit findings should have had:
// every check here failed (i.e. the attack succeeded) before migration
// 0008_rls_hardening.sql. They run as a hostile client holding nothing
// but the publishable anon key and an anonymous session — exactly what
// ships inside the iOS binary and the web bundle.
//
//   npm run test:rls        (requires Docker + `supabase start`)
//
// Fixtures are created with the service-role key, which bypasses RLS on
// purpose: the point is to set up realistic state and then prove that a
// client key cannot reach it.

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const API_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

/** Service-role client. Bypasses RLS — fixtures and assertions only. */
const admin = createClient(API_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** A fresh anonymous player, the way the app creates one. */
async function newPlayer(displayName: string): Promise<{ client: SupabaseClient; user: User }> {
  const client = createClient(API_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInAnonymously({
    options: { data: { display_name: displayName } },
  });
  if (error || !data.user) throw new Error(`anon sign-in failed: ${error?.message}`);
  return { client, user: data.user };
}

/** Unauthenticated client — a Solo player, who never signs in. */
const anonNoSession = createClient(API_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let code = 0;
function roomCode(): string {
  code += 1;
  return `T${String(code).padStart(5, '0')}`;
}

async function createRoom(hostId: string, phase = 'lobby') {
  const { data, error } = await admin
    .from('rooms')
    .insert({ code: roomCode(), host_id: hostId, phase, timer_seconds: 180, letters_26: 'A'.repeat(26) })
    .select()
    .single();
  if (error) throw new Error(`fixture createRoom: ${error.message}`);
  return data as { id: string; code: string };
}

async function addMember(roomId: string, playerId: string) {
  const { error } = await admin.from('room_players').insert({ room_id: roomId, player_id: playerId });
  if (error) throw new Error(`fixture addMember: ${error.message}`);
}

async function setPhase(roomId: string, phase: string) {
  const { error } = await admin.from('rooms').update({ phase }).eq('id', roomId);
  if (error) throw new Error(`fixture setPhase: ${error.message}`);
}

async function addSubmission(roomId: string, playerId: string, rowIndex: number, name: string) {
  const { data, error } = await admin
    .from('submissions')
    .insert({ room_id: roomId, player_id: playerId, row_index: rowIndex, initials: 'AA', name })
    .select()
    .single();
  if (error) throw new Error(`fixture addSubmission: ${error.message}`);
  return data as { id: string };
}

let victim: Awaited<ReturnType<typeof newPlayer>>;
let attacker: Awaited<ReturnType<typeof newPlayer>>;
let bystander: Awaited<ReturnType<typeof newPlayer>>;

beforeAll(async () => {
  const probe = await admin.from('rooms').select('id').limit(1);
  if (probe.error) {
    throw new Error(
      `Local Supabase is not reachable at ${API_URL}. Run \`supabase start\` first. (${probe.error.message})`,
    );
  }
  victim = await newPlayer('Victim');
  attacker = await newPlayer('Attacker');
  bystander = await newPlayer('Bystander');
}, 60_000);

afterAll(async () => {
  for (const p of [victim, attacker, bystander]) {
    if (p?.user) await admin.auth.admin.deleteUser(p.user.id).catch(() => {});
  }
});

// ---------------------------------------------------------------------
// S1 — privilege escalation
// ---------------------------------------------------------------------

describe('S1 privilege escalation via profiles.is_admin', () => {
  it('a player cannot promote themselves to admin', async () => {
    const { error } = await attacker.client
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', attacker.user.id);
    expect(error).not.toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', attacker.user.id)
      .single();
    expect(data?.is_admin).toBe(false);
  });

  it('a player cannot promote someone else either', async () => {
    await attacker.client.from('profiles').update({ is_admin: true }).eq('id', victim.user.id);
    const { data } = await admin.from('profiles').select('is_admin').eq('id', victim.user.id).single();
    expect(data?.is_admin).toBe(false);
  });

  it('a player can still rename themselves (the one write clients need)', async () => {
    const { error } = await attacker.client
      .from('profiles')
      .update({ display_name: 'Renamed' })
      .eq('id', attacker.user.id);
    expect(error).toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', attacker.user.id)
      .single();
    expect(data?.display_name).toBe('Renamed');
  });

  it('a player cannot rename someone else', async () => {
    await attacker.client.from('profiles').update({ display_name: 'Hacked' }).eq('id', victim.user.id);
    const { data } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', victim.user.id)
      .single();
    expect(data?.display_name).not.toBe('Hacked');
  });
});

// ---------------------------------------------------------------------
// S2 — profile enumeration
// ---------------------------------------------------------------------

describe('S2 profile enumeration', () => {
  it('a player sees only their own profile when they share no room', async () => {
    const { data, error } = await bystander.client.from('profiles').select('id');
    expect(error).toBeNull();
    expect(data?.map((r) => r.id)).toEqual([bystander.user.id]);
  });

  it('players in the same room can see each other (the app needs this)', async () => {
    const room = await createRoom(victim.user.id);
    await addMember(room.id, victim.user.id);
    await addMember(room.id, attacker.user.id);

    const { data } = await attacker.client.from('profiles').select('id, display_name');
    const ids = (data ?? []).map((r) => r.id).sort();
    expect(ids).toEqual([attacker.user.id, victim.user.id].sort());
  });

  it('a player outside the room is still invisible', async () => {
    const { data } = await attacker.client.from('profiles').select('id').eq('id', bystander.user.id);
    expect(data).toEqual([]);
  });
});

// ---------------------------------------------------------------------
// S3 / S4 — mid-phase joins and answer leakage
// ---------------------------------------------------------------------

describe('S3/S4 room membership and answer visibility', () => {
  it('a player can join a room that is still in the lobby', async () => {
    const room = await createRoom(victim.user.id, 'lobby');
    const { error } = await attacker.client
      .from('room_players')
      .insert({ room_id: room.id, player_id: attacker.user.id });
    expect(error).toBeNull();
  });

  it('a player cannot join a room that is already playing', async () => {
    const room = await createRoom(victim.user.id, 'playing');
    const { error } = await attacker.client
      .from('room_players')
      .insert({ room_id: room.id, player_id: attacker.user.id });
    expect(error).not.toBeNull();
  });

  it('a player cannot join a room that is validating (where answers are readable)', async () => {
    const room = await createRoom(victim.user.id, 'validating');
    const { error } = await attacker.client
      .from('room_players')
      .insert({ room_id: room.id, player_id: attacker.user.id });
    expect(error).not.toBeNull();
  });

  it('a player cannot insert a membership row for somebody else', async () => {
    const room = await createRoom(victim.user.id, 'lobby');
    const { error } = await attacker.client
      .from('room_players')
      .insert({ room_id: room.id, player_id: bystander.user.id });
    expect(error).not.toBeNull();
  });

  it("a non-member cannot read a room's answers during validating", async () => {
    const room = await createRoom(victim.user.id, 'playing');
    await addMember(room.id, victim.user.id);
    await addSubmission(room.id, victim.user.id, 0, 'Alan Turing');
    await setPhase(room.id, 'validating');

    const { data, error } = await attacker.client
      .from('submissions')
      .select('name')
      .eq('room_id', room.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('a member can read answers during validating (the app needs this)', async () => {
    const room = await createRoom(victim.user.id, 'playing');
    await addMember(room.id, victim.user.id);
    await addMember(room.id, attacker.user.id);
    await addSubmission(room.id, victim.user.id, 0, 'Alan Turing');
    await setPhase(room.id, 'validating');

    const { data } = await attacker.client.from('submissions').select('name').eq('room_id', room.id);
    expect(data?.map((r) => r.name)).toContain('Alan Turing');
  });
});

// ---------------------------------------------------------------------
// S5 — submission injection and score dilution
// ---------------------------------------------------------------------

describe('S5 submission injection', () => {
  it('a non-member cannot inject a submission into a room', async () => {
    const room = await createRoom(victim.user.id, 'playing');
    await addMember(room.id, victim.user.id);

    const { error } = await attacker.client.from('submissions').insert({
      room_id: room.id,
      player_id: attacker.user.id,
      row_index: 0,
      initials: 'AT',
      name: 'Alan Turing',
    });
    expect(error).not.toBeNull();
  });

  it('a member can submit during playing (the app needs this)', async () => {
    const room = await createRoom(victim.user.id, 'playing');
    await addMember(room.id, attacker.user.id);

    const { error } = await attacker.client.from('submissions').insert({
      room_id: room.id,
      player_id: attacker.user.id,
      row_index: 1,
      initials: 'MC',
      name: 'Marie Curie',
    });
    expect(error).toBeNull();
  });

  it('a member cannot submit once the round has moved to validating', async () => {
    const room = await createRoom(victim.user.id, 'playing');
    await addMember(room.id, attacker.user.id);
    await setPhase(room.id, 'validating');

    const { error } = await attacker.client.from('submissions').insert({
      room_id: room.id,
      player_id: attacker.user.id,
      row_index: 2,
      initials: 'AT',
      name: 'Alan Turing',
    });
    expect(error).not.toBeNull();
  });

  it('a member cannot rewrite their own answers after seeing everyone else’s', async () => {
    const room = await createRoom(victim.user.id, 'playing');
    await addMember(room.id, attacker.user.id);
    const sub = await addSubmission(room.id, attacker.user.id, 3, 'Wrong Guess');
    await setPhase(room.id, 'validating');

    await attacker.client.from('submissions').update({ name: 'Alan Turing' }).eq('id', sub.id);
    const { data } = await admin.from('submissions').select('name').eq('id', sub.id).single();
    expect(data?.name).toBe('Wrong Guess');
  });

  it("a player cannot edit another player's submission", async () => {
    const room = await createRoom(victim.user.id, 'playing');
    await addMember(room.id, victim.user.id);
    await addMember(room.id, attacker.user.id);
    const sub = await addSubmission(room.id, victim.user.id, 4, 'Marie Curie');

    await attacker.client.from('submissions').update({ name: 'Sabotage' }).eq('id', sub.id);
    const { data } = await admin.from('submissions').select('name').eq('id', sub.id).single();
    expect(data?.name).toBe('Marie Curie');
  });
});

// ---------------------------------------------------------------------
// votes
// ---------------------------------------------------------------------

describe('votes', () => {
  it('a non-member cannot vote in a room', async () => {
    const room = await createRoom(victim.user.id, 'playing');
    await addMember(room.id, victim.user.id);
    const sub = await addSubmission(room.id, victim.user.id, 0, 'Alan Turing');
    await setPhase(room.id, 'validating');

    const { error } = await attacker.client
      .from('votes')
      .insert({ room_id: room.id, submission_id: sub.id, voter_id: attacker.user.id, is_valid: true });
    expect(error).not.toBeNull();
  });

  it('a member can vote during validating (the app needs this)', async () => {
    const room = await createRoom(victim.user.id, 'playing');
    await addMember(room.id, victim.user.id);
    await addMember(room.id, attacker.user.id);
    const sub = await addSubmission(room.id, victim.user.id, 0, 'Alan Turing');
    await setPhase(room.id, 'validating');

    const { error } = await attacker.client
      .from('votes')
      .insert({ room_id: room.id, submission_id: sub.id, voter_id: attacker.user.id, is_valid: true });
    expect(error).toBeNull();
  });

  it('a member cannot vote for their own submission', async () => {
    const room = await createRoom(victim.user.id, 'playing');
    await addMember(room.id, attacker.user.id);
    const sub = await addSubmission(room.id, attacker.user.id, 0, 'Alan Turing');
    await setPhase(room.id, 'validating');

    const { error } = await attacker.client
      .from('votes')
      .insert({ room_id: room.id, submission_id: sub.id, voter_id: attacker.user.id, is_valid: true });
    expect(error).not.toBeNull();
  });

  it('a vote cannot point at a submission from a different room', async () => {
    const roomA = await createRoom(victim.user.id, 'playing');
    await addMember(roomA.id, victim.user.id);
    const subA = await addSubmission(roomA.id, victim.user.id, 0, 'Alan Turing');

    const roomB = await createRoom(victim.user.id, 'playing');
    await addMember(roomB.id, attacker.user.id);
    await setPhase(roomB.id, 'validating');

    const { error } = await attacker.client
      .from('votes')
      .insert({ room_id: roomB.id, submission_id: subA.id, voter_id: attacker.user.id, is_valid: false });
    expect(error).not.toBeNull();
  });

  it('a player cannot vote twice on the same submission', async () => {
    const room = await createRoom(victim.user.id, 'playing');
    await addMember(room.id, victim.user.id);
    await addMember(room.id, attacker.user.id);
    const sub = await addSubmission(room.id, victim.user.id, 0, 'Alan Turing');
    await setPhase(room.id, 'validating');

    const first = await attacker.client
      .from('votes')
      .insert({ room_id: room.id, submission_id: sub.id, voter_id: attacker.user.id, is_valid: true });
    expect(first.error).toBeNull();

    const second = await attacker.client
      .from('votes')
      .insert({ room_id: room.id, submission_id: sub.id, voter_id: attacker.user.id, is_valid: false });
    expect(second.error).not.toBeNull();

    const { count } = await admin
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('submission_id', sub.id);
    expect(count).toBe(1);
  });

  it('a player cannot cast a vote in somebody else’s name', async () => {
    const room = await createRoom(victim.user.id, 'playing');
    await addMember(room.id, victim.user.id);
    await addMember(room.id, attacker.user.id);
    await addMember(room.id, bystander.user.id);
    const sub = await addSubmission(room.id, victim.user.id, 0, 'Alan Turing');
    await setPhase(room.id, 'validating');

    const { error } = await attacker.client
      .from('votes')
      .insert({ room_id: room.id, submission_id: sub.id, voter_id: bystander.user.id, is_valid: true });
    expect(error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------
// S6 — validation_reviews authorship
// ---------------------------------------------------------------------

describe('S6 validation_reviews authorship', () => {
  const base = { name: 'Alan Turing', expected_pair: 'AT', actual_result: 'invalid', trace: [] };

  it('a Solo player with no session can still file a review', async () => {
    const { error } = await anonNoSession
      .from('validation_reviews')
      .insert({ ...base, player_id: null });
    expect(error).toBeNull();
  });

  it('a signed-in player can file a review as themselves', async () => {
    const { error } = await attacker.client
      .from('validation_reviews')
      .insert({ ...base, player_id: attacker.user.id });
    expect(error).toBeNull();
  });

  it("a player cannot file a review under somebody else's id", async () => {
    const { error } = await attacker.client
      .from('validation_reviews')
      .insert({ ...base, player_id: victim.user.id });
    expect(error).not.toBeNull();
  });

  it('a player cannot file a review that is already resolved', async () => {
    const { error } = await attacker.client.from('validation_reviews').insert({
      ...base,
      player_id: attacker.user.id,
      status: 'approved',
      resolution_type: 'fix_validator',
      resolution_note: 'forged',
    });
    expect(error).not.toBeNull();
  });

  it('a player cannot read reviews filed by other people', async () => {
    await admin.from('validation_reviews').insert({ ...base, player_id: victim.user.id, name: 'Secret Row' });
    const { data } = await attacker.client.from('validation_reviews').select('name').eq('name', 'Secret Row');
    expect(data).toEqual([]);
  });

  it('a player cannot resolve a review', async () => {
    const { data: row } = await admin
      .from('validation_reviews')
      .insert({ ...base, player_id: attacker.user.id, name: 'Mine To Resolve' })
      .select()
      .single();

    await attacker.client
      .from('validation_reviews')
      .update({ status: 'approved' })
      .eq('id', (row as { id: string }).id);

    const { data } = await admin
      .from('validation_reviews')
      .select('status')
      .eq('id', (row as { id: string }).id)
      .single();
    expect(data?.status).toBe('pending');
  });
});

// ---------------------------------------------------------------------
// scoring RPCs stay server-side
// ---------------------------------------------------------------------

describe('scoring RPCs', () => {
  it('compute_room_scores is not callable by a client', async () => {
    const room = await createRoom(victim.user.id, 'validating');
    const { error } = await attacker.client.rpc('compute_room_scores', { p_room_id: room.id });
    expect(error).not.toBeNull();
  });

  it('a non-host cannot finalize a round', async () => {
    const room = await createRoom(victim.user.id, 'validating');
    await addMember(room.id, attacker.user.id);
    const { error } = await attacker.client.rpc('finalize_round', { p_room_id: room.id });
    expect(error).not.toBeNull();
  });

  it('a non-host cannot start a round', async () => {
    const room = await createRoom(victim.user.id, 'lobby');
    await addMember(room.id, attacker.user.id);
    const { error } = await attacker.client.rpc('start_round', {
      p_room_id: room.id,
      p_sentence: '{}',
      p_letters: 'A'.repeat(26),
    });
    expect(error).not.toBeNull();
  });

  it('a non-member cannot force a phase advance', async () => {
    const room = await createRoom(victim.user.id, 'playing');
    const { error } = await attacker.client.rpc('advance_phase_if_expired', { p_room_id: room.id });
    expect(error).not.toBeNull();
  });

  it('a non-host cannot reset a room', async () => {
    const room = await createRoom(victim.user.id, 'results');
    await addMember(room.id, attacker.user.id);
    const { error } = await attacker.client.rpc('reset_room_for_new_round', {
      p_room_id: room.id,
      p_sentence: '{}',
      p_letters: 'A'.repeat(26),
      p_timer_seconds: 180,
    });
    expect(error).not.toBeNull();
  });
});
