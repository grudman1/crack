// Player-feedback queue: submit, list, resolve.
//
// All three operations hit the validation_reviews table directly via the
// Supabase client. RLS keeps writes anonymous-allowed but reads/updates
// admin-gated, so the SQL policies are the source of truth — this
// service trusts them and doesn't re-check.

import { supabase } from '@/services/supabase';
import { getClientFingerprint } from '@/lib/clientFingerprint';
import type {
  ResolutionType,
  ReviewStatus,
  ValidationReviewRow,
} from '@/types/database';
import type { TraceRecord } from '@/services/wikiValidationService';

export interface SubmitReviewInput {
  name: string;
  expectedPair: string;
  actualResult: 'valid' | 'invalid';
  reason?: string | null;
  trace: TraceRecord[];
  userComment?: string;
}

export async function submitReview(input: SubmitReviewInput): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const playerId = auth.user?.id ?? null;
  const fingerprint = getClientFingerprint();

  const payload = {
    name: input.name.trim(),
    expected_pair: input.expectedPair.toUpperCase().slice(0, 2),
    actual_result: input.actualResult,
    reason: input.reason ?? null,
    trace: input.trace,
    player_id: playerId,
    user_comment: input.userComment?.trim() || null,
    client_fingerprint: fingerprint,
  };

  const { data, error } = await supabase
    .from('validation_reviews')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function listReviews(
  status?: ReviewStatus,
): Promise<ValidationReviewRow[]> {
  let q = supabase
    .from('validation_reviews')
    .select('*')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ValidationReviewRow[];
}

export type Resolution =
  | { kind: 'approved'; resolutionType: Exclude<ResolutionType, null>; note?: string }
  | { kind: 'rejected'; note?: string }
  | { kind: 'duplicate'; note?: string };

export async function resolveReview(id: string, resolution: Resolution): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const reviewerId = auth.user?.id ?? null;

  const patch: Record<string, unknown> = {
    status: resolution.kind,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    resolution_note: resolution.note?.trim() || null,
    resolution_type:
      resolution.kind === 'approved' ? resolution.resolutionType : null,
  };

  const { error } = await supabase
    .from('validation_reviews')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}
