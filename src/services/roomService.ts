import { supabase } from './supabase';
import type { Phase, RoomRow, SubmissionRow, VoteRow, ScoreRow } from '@/types/database';

const ROOM_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude 0/O/1/I

export function generateRoomCode(len = 6): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ROOM_CODE_CHARSET[Math.floor(Math.random() * ROOM_CODE_CHARSET.length)];
  }
  return out;
}

export async function createRoom(hostId: string, timerSeconds = 180): Promise<RoomRow> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const { data, error } = await supabase
      .from('rooms')
      .insert({ code, host_id: hostId, timer_seconds: timerSeconds, phase: 'lobby' })
      .select()
      .single();
    if (!error && data) {
      await supabase.from('room_players').insert({ room_id: data.id, player_id: hostId });
      return data as RoomRow;
    }
    if (error && error.code !== '23505') throw error;
  }
  throw new Error('Could not generate a unique room code.');
}

export async function findRoomByCode(code: string): Promise<RoomRow | null> {
  const { data, error } = await supabase.from('rooms').select('*').eq('code', code.toUpperCase()).maybeSingle();
  if (error) throw error;
  return (data as RoomRow | null) ?? null;
}

export async function joinRoom(roomId: string, playerId: string): Promise<void> {
  await supabase.from('room_players').upsert({ room_id: roomId, player_id: playerId }, { onConflict: 'room_id,player_id' });
}

export async function leaveRoom(roomId: string, playerId: string): Promise<void> {
  await supabase.from('room_players').delete().match({ room_id: roomId, player_id: playerId });
}

export async function setRoomPhase(roomId: string, phase: Phase, extras?: Partial<RoomRow>): Promise<void> {
  const { error } = await supabase
    .from('rooms')
    .update({ phase, ...(extras as object) })
    .eq('id', roomId);
  if (error) throw error;
}

export async function upsertSubmission(
  roomId: string,
  playerId: string,
  rowIndex: number,
  initials: string,
  name: string,
): Promise<void> {
  const { error } = await supabase
    .from('submissions')
    .upsert(
      { room_id: roomId, player_id: playerId, row_index: rowIndex, initials, name },
      { onConflict: 'room_id,player_id,row_index' },
    );
  if (error) throw error;
}

export async function fetchSubmissions(roomId: string): Promise<SubmissionRow[]> {
  const { data, error } = await supabase.from('submissions').select('*').eq('room_id', roomId);
  if (error) throw error;
  return (data ?? []) as SubmissionRow[];
}

export async function castVote(
  roomId: string,
  submissionId: string,
  voterId: string,
  isValid: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('votes')
    .upsert(
      { room_id: roomId, submission_id: submissionId, voter_id: voterId, is_valid: isValid },
      { onConflict: 'submission_id,voter_id' },
    );
  if (error) throw error;
}

export async function fetchVotes(roomId: string): Promise<VoteRow[]> {
  const { data, error } = await supabase.from('votes').select('*').eq('room_id', roomId);
  if (error) throw error;
  return (data ?? []) as VoteRow[];
}

export async function computeScores(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('compute_room_scores', { p_room_id: roomId });
  if (error) throw error;
}

export async function fetchScores(roomId: string): Promise<ScoreRow[]> {
  const { data, error } = await supabase.from('scores').select('*').eq('room_id', roomId);
  if (error) throw error;
  return (data ?? []) as ScoreRow[];
}

export async function resetRoomForNewRound(
  roomId: string,
  sentence: string,
  letters: string,
  timerSeconds: number,
): Promise<void> {
  await supabase.from('submissions').delete().eq('room_id', roomId);
  await supabase.from('votes').delete().eq('room_id', roomId);
  await supabase.from('scores').delete().eq('room_id', roomId);
  await supabase
    .from('rooms')
    .update({ phase: 'lobby', sentence, letters_26: letters, timer_seconds: timerSeconds })
    .eq('id', roomId);
}
