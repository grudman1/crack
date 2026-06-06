// Vercel serverless function — POST /api/delete-account
//
// Backs the in-app "Delete account" flow. Apple Guideline 5.1.1(v)
// requires this for any app that supports account creation;
// Crack's anonymous Supabase auth qualifies because it creates a
// real auth.users row + profiles row per player.
//
// Flow:
//   1. Caller (the signed-in user) sends `Authorization: Bearer <access_token>`.
//   2. We use the service-role key to verify the token via admin.auth.getUser
//      — this both authenticates the caller and gives us their user.id.
//   3. We delete via admin.auth.admin.deleteUser, which cascades through
//      every FK ON DELETE CASCADE in 0001 (profiles → room_players,
//      submissions, votes, scores, hosted rooms). No orphans.
//
// Service-role key is read from process.env.SUPABASE_SERVICE_ROLE_KEY
// (no VITE_ prefix — that would expose it in the client bundle).

import { createClient } from '@supabase/supabase-js';

// Vercel provides req/res but the typings live in @vercel/node, which
// isn't installed. `any` is fine for a one-off function — Vercel
// transpiles this at deploy time, our local TS build doesn't include it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = (req.headers.authorization as string | undefined)?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ error: 'Server misconfigured' });

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: authErr,
  } = await admin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid session' });

  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
  if (deleteErr) return res.status(500).json({ error: 'Deletion failed' });

  return res.status(204).end();
}
