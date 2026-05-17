// Tiny helpers for reading + writing the current player's display
// name on profiles. Used by Multiplayer.tsx (pre-fill the input from
// the existing profile when a session exists; update the profile
// when the player edits the name before creating/joining a room).

import { supabase } from './supabase';

export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  const trimmed = displayName.trim() || 'Player';
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', userId);
  if (error) throw error;
}

export async function getDisplayName(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return (data as { display_name?: string } | null)?.display_name ?? null;
}
