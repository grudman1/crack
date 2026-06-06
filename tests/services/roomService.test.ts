import { describe, it, expect, vi, beforeEach } from 'vitest';

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

const rpcCalls: RpcCall[] = [];
let nextRpcError: { message: string } | null = null;

vi.mock('@/services/supabase', () => {
  return {
    supabase: {
      rpc: vi.fn((fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args });
        return Promise.resolve({ data: null, error: nextRpcError });
      }),
    },
    SUPABASE_CONFIGURED: true,
  };
});

import { resetRoomForNewRound, startRound, advancePhaseIfExpired } from '@/services/roomService';

beforeEach(() => {
  rpcCalls.length = 0;
  nextRpcError = null;
});

describe('resetRoomForNewRound', () => {
  it('calls the reset_room_for_new_round RPC with the four p_* params', async () => {
    await resetRoomForNewRound('room-1', 'a quick brown fox', 'AQBFJUMPSOVERTHELAZYDOG', 90);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe('reset_room_for_new_round');
    expect(rpcCalls[0].args).toEqual({
      p_room_id: 'room-1',
      p_sentence: 'a quick brown fox',
      p_letters: 'AQBFJUMPSOVERTHELAZYDOG',
      p_timer_seconds: 90,
    });
  });

  it('throws when the RPC returns an error', async () => {
    nextRpcError = { message: 'only the host can reset the room' };
    await expect(
      resetRoomForNewRound('room-1', 's', 'L', 60),
    ).rejects.toMatchObject({ message: 'only the host can reset the room' });
  });
});

describe('startRound', () => {
  it('calls the start_round RPC with the three p_* params', async () => {
    await startRound('room-1', '{"text":"phrase"}', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(rpcCalls).toEqual([
      {
        fn: 'start_round',
        args: {
          p_room_id: 'room-1',
          p_sentence: '{"text":"phrase"}',
          p_letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        },
      },
    ]);
  });

  it('rethrows the RPC error (e.g. non-host caller)', async () => {
    nextRpcError = { message: 'only the host can start a round' };
    await expect(startRound('room-1', 's', 'L')).rejects.toMatchObject({
      message: 'only the host can start a round',
    });
  });
});

describe('advancePhaseIfExpired', () => {
  it('calls the advance_phase_if_expired RPC with the room id', async () => {
    await advancePhaseIfExpired('room-1');
    expect(rpcCalls).toEqual([
      { fn: 'advance_phase_if_expired', args: { p_room_id: 'room-1' } },
    ]);
  });

  it('rethrows the RPC error (e.g. non-member caller)', async () => {
    nextRpcError = { message: 'must be a room member' };
    await expect(advancePhaseIfExpired('room-1')).rejects.toMatchObject({
      message: 'must be a room member',
    });
  });
});
