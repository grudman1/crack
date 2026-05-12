import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import type { ProfileRow, RoomPlayerRow } from '@/types/database';

export interface RoomPlayer extends RoomPlayerRow {
  profile?: ProfileRow;
}

export function useRoomPlayers(roomId: string | undefined) {
  const [players, setPlayers] = useState<RoomPlayer[]>([]);

  useEffect(() => {
    if (!roomId) return;
    let alive = true;

    const load = async () => {
      const { data: rp } = await supabase.from('room_players').select('*').eq('room_id', roomId);
      const list = (rp ?? []) as RoomPlayerRow[];
      const playerIds = list.map((p) => p.player_id);
      const profiles: Record<string, ProfileRow> = {};
      if (playerIds.length) {
        const { data: pr } = await supabase.from('profiles').select('*').in('id', playerIds);
        for (const p of (pr ?? []) as ProfileRow[]) profiles[p.id] = p;
      }
      if (!alive) return;
      setPlayers(list.map((p) => ({ ...p, profile: profiles[p.player_id] })));
    };

    void load();
    const channel = supabase
      .channel(`room_players:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  return players;
}
