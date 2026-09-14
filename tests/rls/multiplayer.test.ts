/// <reference types="node" />
// Two-player multiplayer round-trip, end to end, on every push.
//
// This exists because multiplayer was broken in production for months
// and nothing caught it. public.finalize_round was missing — two
// migrations shared a `0006` prefix, the integration recorded that
// version once and silently skipped the other file — so every game in
// production died at the voting screen with an error toast. The repo was
// correct the whole time; only the deployed database was wrong, and no
// test ever drove the flow.
//
// So this drives the real flow through the real RPCs against a real
// Postgres with the real policies: create, join, start, submit, vote,
// finalize, score, reset. Anything that removes an RPC, changes a guard,
// or tightens a policy past what the game needs fails here rather than
// in front of a player.
//
//   npm run test:rls        (requires Docker + `supabase start`)
//
// Note this catches "the migrations are wrong". It cannot catch "the
// migrations did not reach production" — that is what
// scripts/prodSmoke.ts is for, and why it runs after deploy.

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const API_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const admin = createClient(API_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** A player, created the way the app creates one. */
async function player(displayName: string): Promise<{ client: SupabaseClient; user: User }> {
  const client = createClient(API_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInAnonymously({
    options: { data: { display_name: displayName } },
  });
  if (error || !data.user) throw new Error(`anonymous sign-in failed: ${error?.message}`);
  return { client, user: data.user };
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

let host: Awaited<ReturnType<typeof player>>;
let guest: Awaited<ReturnType<typeof player>>;
let roomId: string;
let roomCode: string;

beforeAll(async () => {
  const probe = await admin.from('rooms').select('id').limit(1);
  if (probe.error) {
    throw new Error(`Local Supabase unreachable at ${API_URL}. Run \`supabase start\`. (${probe.error.message})`);
  }
  host = await player('Host');
  guest = await player('Guest');
}, 60_000);

afterAll(async () => {
  if (roomId) await admin.from('rooms').delete().eq('id', roomId);
  for (const p of [host, guest]) {
    if (p?.user) await admin.auth.admin.deleteUser(p.user.id).catch(() => {});
  }
});

describe('a full two-player round', () => {
  it('the host creates a room through the client path', async () => {
    // Mirrors roomService.createRoom: insert the room, then the host's
    // own membership row. Both are plain client writes under RLS.
    roomCode = `M${Math.floor(Math.random() * 90000 + 10000)}`;
    const { data, error } = await host.client
      .from('rooms')
      .insert({ code: roomCode, host_id: host.user.id, timer_seconds: 180, phase: 'lobby' })
      .select()
      .single();
    expect(error, error?.message).toBeNull();
    roomId = (data as { id: string }).id;

    const membership = await host.client
      .from('room_players')
      .insert({ room_id: roomId, player_id: host.user.id });
    expect(membership.error, membership.error?.message).toBeNull();
  });

  it('a guest finds the room by code and joins', async () => {
    const found = await guest.client.from('rooms').select('*').eq('code', roomCode).maybeSingle();
    expect(found.error, found.error?.message).toBeNull();
    expect(found.data).not.toBeNull();

    // joinRoom uses ON CONFLICT DO NOTHING; room_players has no UPDATE
    // policy, so the DO UPDATE path would be rejected on any re-join.
    const join = await guest.client
      .from('room_players')
      .upsert({ room_id: roomId, player_id: guest.user.id }, { onConflict: 'room_id,player_id', ignoreDuplicates: true });
    expect(join.error, join.error?.message).toBeNull();
  });

  it('re-joining an existing membership is a no-op, not an error', async () => {
    // The remount case: any refresh mid-session calls joinRoom again.
    const again = await guest.client
      .from('room_players')
      .upsert({ room_id: roomId, player_id: guest.user.id }, { onConflict: 'room_id,player_id', ignoreDuplicates: true });
    expect(again.error, again.error?.message).toBeNull();
  });

  it('both players are visible in the lobby', async () => {
    const { data, error } = await guest.client.from('room_players').select('player_id').eq('room_id', roomId);
    expect(error, error?.message).toBeNull();
    expect((data ?? []).map((r) => r.player_id).sort()).toEqual([host.user.id, guest.user.id].sort());
  });

  it('players can read each other’s display names', async () => {
    // useRoomPlayers joins profiles in memory to label the leaderboard.
    // Scoped to room co-members by 0008, so this is the check that the
    // scoping did not go too far.
    const { data } = await guest.client.from('profiles').select('id, display_name').in('id', [host.user.id, guest.user.id]);
    expect((data ?? []).length).toBe(2);
  });

  it('only the host can start the round', async () => {
    const asGuest = await guest.client.rpc('start_round', {
      p_room_id: roomId, p_sentence: '{}', p_letters: LETTERS,
    });
    expect(asGuest.error, 'a guest must not be able to start the round').not.toBeNull();

    const asHost = await host.client.rpc('start_round', {
      p_room_id: roomId, p_sentence: '{}', p_letters: LETTERS,
    });
    expect(asHost.error, asHost.error?.message).toBeNull();
  });

  it('starting stamps play_started_at, which is what drives every client’s timer', async () => {
    const { data } = await admin.from('rooms').select('phase, play_started_at').eq('id', roomId).single();
    expect(data?.phase).toBe('playing');
    expect(data?.play_started_at).not.toBeNull();
  });

  it('both players submit answers', async () => {
    // Different names on the same row on purpose: the duplicate rule
    // halves matching answers, and this flow is exercising the
    // full-points path. The halving has its own test below.
    const answers = [
      [host, 'Alan Turing'],
      [guest, 'Audrey Tautou'],
    ] as const;
    for (const [p, name] of answers) {
      const { error } = await p.client.from('submissions').insert({
        room_id: roomId, player_id: p.user.id, row_index: 0, initials: 'AT', name,
      });
      expect(error, `${name}: ${error?.message}`).toBeNull();
    }
  });

  it('autosave overwrites a row rather than duplicating it', async () => {
    const { error } = await host.client.from('submissions').upsert(
      { room_id: roomId, player_id: host.user.id, row_index: 1, initials: 'MC', name: 'Marie C' },
      { onConflict: 'room_id,player_id,row_index' },
    );
    expect(error, error?.message).toBeNull();

    const second = await host.client.from('submissions').upsert(
      { room_id: roomId, player_id: host.user.id, row_index: 1, initials: 'MC', name: 'Marie Curie' },
      { onConflict: 'room_id,player_id,row_index' },
    );
    expect(second.error, second.error?.message).toBeNull();

    const { data } = await admin.from('submissions').select('name').eq('room_id', roomId).eq('row_index', 1);
    expect(data).toHaveLength(1);
    expect(data?.[0]?.name).toBe('Marie Curie');
  });

  it('answers stay private while the round is playing', async () => {
    const { data } = await guest.client.from('submissions').select('player_id').eq('room_id', roomId);
    expect((data ?? []).every((s) => s.player_id === guest.user.id)).toBe(true);
  });

  it('any member can advance an expired round, not just the host', async () => {
    // A host who closes their tab must not strand everyone else, so the
    // RPC is member-callable and only acts once the timer is actually up.
    await admin.from('rooms').update({ play_started_at: new Date(Date.now() - 600_000).toISOString() }).eq('id', roomId);
    const { error } = await guest.client.rpc('advance_phase_if_expired', { p_room_id: roomId });
    expect(error, error?.message).toBeNull();

    const { data } = await admin.from('rooms').select('phase').eq('id', roomId).single();
    expect(data?.phase).toBe('validating');
  });

  it('answers become visible to the room once voting starts', async () => {
    const { data, error } = await guest.client.from('submissions').select('id, player_id, name').eq('room_id', roomId);
    expect(error, error?.message).toBeNull();
    expect((data ?? []).some((s) => s.player_id === host.user.id)).toBe(true);
  });

  it('a player votes on someone else’s answer but not their own', async () => {
    const { data: subs } = await guest.client.from('submissions').select('id, player_id').eq('room_id', roomId);
    const hostSub = (subs ?? []).find((s) => s.player_id === host.user.id)!;
    const ownSub = (subs ?? []).find((s) => s.player_id === guest.user.id)!;

    const good = await guest.client.from('votes').insert({
      room_id: roomId, submission_id: hostSub.id, voter_id: guest.user.id, is_valid: true,
    });
    expect(good.error, good.error?.message).toBeNull();

    const own = await guest.client.from('votes').insert({
      room_id: roomId, submission_id: ownSub.id, voter_id: guest.user.id, is_valid: true,
    });
    expect(own.error, 'voting for your own submission must be rejected').not.toBeNull();
  });

  it('a player can change their mind while voting is open', async () => {
    const { data: subs } = await admin.from('submissions').select('id, player_id').eq('room_id', roomId);
    const hostSub = (subs ?? []).find((s) => s.player_id === host.user.id)!;
    const { error } = await guest.client.from('votes').upsert(
      { room_id: roomId, submission_id: hostSub.id, voter_id: guest.user.id, is_valid: false },
      { onConflict: 'submission_id,voter_id' },
    );
    expect(error, error?.message).toBeNull();

    // Put it back so the scoring assertion below is meaningful.
    await guest.client.from('votes').upsert(
      { room_id: roomId, submission_id: hostSub.id, voter_id: guest.user.id, is_valid: true },
      { onConflict: 'submission_id,voter_id' },
    );
  });

  // The regression this whole file exists for.
  it('the host finalizes the round — the RPC that was missing from production', async () => {
    const asGuest = await guest.client.rpc('finalize_round', { p_room_id: roomId });
    expect(asGuest.error, 'a guest must not be able to finalize').not.toBeNull();

    const { error } = await host.client.rpc('finalize_round', { p_room_id: roomId });
    expect(error, error?.message).toBeNull();
  });

  it('finalizing writes scores and flips the phase in one step', async () => {
    const { data: room } = await admin.from('rooms').select('phase').eq('id', roomId).single();
    expect(room?.phase).toBe('results');

    const { data: scores } = await admin.from('scores').select('player_id, total, breakdown').eq('room_id', roomId);
    expect((scores ?? []).length).toBeGreaterThan(0);

    // The host's row 0 answer got one valid vote from the guest and was
    // not duplicated by anyone, so it is worth the full 10.
    const hostScore = (scores ?? []).find((s) => s.player_id === host.user.id);
    expect(hostScore?.total).toBe(10);
  });

  it('members can read the leaderboard', async () => {
    const { data, error } = await guest.client.from('scores').select('player_id, total').eq('room_id', roomId);
    expect(error, error?.message).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it('the host resets for a new round, clearing the last one', async () => {
    const { error } = await host.client.rpc('reset_room_for_new_round', {
      p_room_id: roomId, p_sentence: '{}', p_letters: LETTERS, p_timer_seconds: 180,
    });
    expect(error, error?.message).toBeNull();

    const { data: room } = await admin.from('rooms').select('phase').eq('id', roomId).single();
    expect(room?.phase).toBe('lobby');

    for (const table of ['submissions', 'votes', 'scores'] as const) {
      const { count } = await admin.from(table).select('*', { count: 'exact', head: true }).eq('room_id', roomId);
      expect(count, `${table} should be empty after a reset`).toBe(0);
    }
  });

  it('both players are still in the room after the reset', async () => {
    // Membership survives a reset; only round data is cleared. If this
    // broke, everyone would be silently ejected between rounds.
    const { data } = await admin.from('room_players').select('player_id').eq('room_id', roomId);
    expect((data ?? []).length).toBe(2);
  });
});

describe('scoring rules', () => {
  it('a duplicated answer is worth half', async () => {
    // compute_room_scores halves an answer that another player wrote on
    // the same row. This is also the mechanic the score-dilution attack
    // in 0008 abused, so it is worth pinning.
    const code = `D${Math.floor(Math.random() * 90000 + 10000)}`;
    const { data: room } = await admin
      .from('rooms')
      .insert({ code, host_id: host.user.id, timer_seconds: 180, phase: 'playing', letters_26: LETTERS })
      .select()
      .single();
    const id = (room as { id: string }).id;
    await admin.from('room_players').insert([
      { room_id: id, player_id: host.user.id },
      { room_id: id, player_id: guest.user.id },
    ]);

    const { data: subs } = await admin
      .from('submissions')
      .insert([
        { room_id: id, player_id: host.user.id, row_index: 0, initials: 'AT', name: 'Alan Turing' },
        { room_id: id, player_id: guest.user.id, row_index: 0, initials: 'AT', name: 'alan turing' },
      ])
      .select();

    await admin.from('rooms').update({ phase: 'validating' }).eq('id', id);
    for (const s of subs as { id: string; player_id: string }[]) {
      const voter = s.player_id === host.user.id ? guest : host;
      await voter.client.from('votes').insert({
        room_id: id, submission_id: s.id, voter_id: voter.user.id, is_valid: true,
      });
    }

    const { error } = await host.client.rpc('finalize_round', { p_room_id: id });
    expect(error, error?.message).toBeNull();

    const { data: scores } = await admin.from('scores').select('total').eq('room_id', id);
    // Case and whitespace are normalised, so both count as duplicates.
    expect((scores ?? []).map((s) => s.total)).toEqual([5, 5]);

    await admin.from('rooms').delete().eq('id', id);
  });
});
