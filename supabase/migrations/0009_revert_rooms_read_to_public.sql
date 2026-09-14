-- CRACK 0006: revert M3 from 0005 — restore public rooms SELECT.
--
-- 0005 tightened rooms SELECT from `using (true)` to
-- `auth.role() = 'authenticated'` as defense in depth. That broke
-- the anonymous deep-link join flow: a visitor opening /mp/<code>
-- without a session needs to read the room row to render the
-- "Join this room" prompt before they sign in anonymously. The
-- tightened policy returned no row, so the page rendered
-- "Room not found".
--
-- Reverting is safe because the sensitive payloads — submissions,
-- votes, scores — are already gated on is_room_member() (C1, H7,
-- M1 in 0005). rooms itself only exposes the code, host_id, phase,
-- timer, and the round's phrase/letters, which are not sensitive.
-- Full per-room gating would need a code-lookup RPC + rewiring
-- useRoom; we'll keep that as a separate decision.

-- 2026-09-14: `drop policy if exists "rooms read all"` added. Without it
-- this file is not idempotent, and it has to be, because renaming it
-- from 0006_ to 0009_ means it runs again on every database that already
-- applied it under the old version. On a fresh database 0005 has left
-- the policy named "rooms read authed", so dropping that name and
-- creating "rooms read all" is enough. On production, where this already
-- ran once as 0006, "rooms read authed" is long gone and "rooms read
-- all" is present — so the create failed with 42710 and took the whole
-- migration run down with it, including 0010.
drop policy if exists "rooms read authed" on public.rooms;
drop policy if exists "rooms read all" on public.rooms;
create policy "rooms read all" on public.rooms for select using (true);
