import { useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { useRealtimeTable } from '@/hooks/useRealtime';
import type { ProfileRow, RoomPlayerRow } from '@/types/database';

export interface RoomPlayer extends RoomPlayerRow {
  profile?: ProfileRow;
}

// Special case: list room_players for a room, then join their profiles
// in memory. Custom loadFn keeps the join logic here while reusing
// realtime + lifecycle from useRealtimeTable. The channel listens on
// room_players only — profile mutations shouldn't re-trigger.
export function useRoomPlayers(roomId: string | undefined): RoomPlayer[] {
  const loadFn = useCallback(async () => {
    if (!roomId) return [];
    const { data: rp } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', roomId);
    const list = (rp ?? []) as RoomPlayerRow[];
    const playerIds = list.map((p) => p.player_id);
    const profiles: Record<string, ProfileRow> = {};
    if (playerIds.length) {
      const { data: pr } = await supabase.from('profiles').select('*').in('id', playerIds);
      for (const p of (pr ?? []) as ProfileRow[]) profiles[p.id] = p;
    }
    return list.map((p) => ({ ...p, profile: profiles[p.player_id] }));
  }, [roomId]);

  const { rows } = useRealtimeTable<RoomPlayer>({
    table: 'room_players',
    matchColumn: 'room_id',
    matchValue: roomId,
    channelKey: roomId ? `room_players:${roomId}` : undefined,
    loadFn: roomId ? loadFn : undefined,
  });
  return rows;
}
