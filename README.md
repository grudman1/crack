# CRACK — the name game

A browser-based "initials game". Every round generates 26 pairs of initials (A–Z paired with the first 26 letters of a random sentence). For each pair, name a famous person whose initials match. Wikipedia + Wikidata is the referee.

Two modes:
- **Solo** — timed round, each answer validated against Wikipedia. 10 points per valid match.
- **Multiplayer** — host creates a 6-char room code, players submit privately, then vote on each other's answers. 10 points for valid + unique, 5 for valid + duplicated.

## Stack

Vite 8 · React 19 · TypeScript · Tailwind v3 · shadcn/ui primitives (Dialog, Accordion, Progress) · Framer Motion · react-router-dom 7 · @supabase/supabase-js · @tanstack/react-query · sonner · lucide-react · vitest

## Scripts

```sh
npm run dev      # Vite dev server on http://localhost:5174
npm run build    # tsc -b && vite build → dist/
npm run preview  # Serve dist locally
npm run test     # Run vitest once
npm run lint     # ESLint
```

## Project structure

```
src/
  components/        Layout, ScrabbleTile, InitialsGrid, TimerBar, PhaseBanner,
                     SuggestionsPanel, ExportButtons, AuthModal, ui/
  pages/             Index, Solo, Multiplayer, Room, HowToPlay, NotFound, DevTiles
  services/          sentenceService, wikiValidationService, soloSuggestions,
                     audioService, exportService, roomService, supabase
  hooks/             useAuth, useRoom, useRoomPlayers, useSubmissions, useVotes, useScores
  lib/               utils (cn), tilePoints, sanitizeError
  types/             database
supabase/
  migrations/0001_initial_schema.sql
tests/
  services/, components/
```

## Setup

1. Copy `.env.example` to `.env.local` and fill in your Supabase URL and anon key.
2. In the Supabase SQL editor (or via `supabase db push`), run `supabase/migrations/0001_initial_schema.sql`. It creates tables, RLS policies, the `compute_room_scores` RPC, and enables realtime for the gameplay tables.
3. (Optional) Regenerate strict types: `npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/database.ts`.
4. `npm run dev`.

Solo mode works without Supabase configured — you'll only need it for Multiplayer.

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import into Vercel; `vercel.json` already sets framework, build command, output dir, and the SPA rewrite (`/* → /index.html`).
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel's environment variables (Production, Preview, Development).
4. After the first deploy, add the Vercel preview URL to Supabase → Authentication → URL Configuration so email confirmation links work in production.

## Admin setup

The `/admin` route is a moderation queue for player-submitted validator
feedback. It's gated on `profiles.is_admin`. After running migration
`0002_validation_reviews.sql`, promote yourself manually:

1. Sign in to the app (any account).
2. Find your user ID in Supabase → Authentication → Users (the UUID
   column).
3. In Supabase SQL Editor:

   ```sql
   update public.profiles set is_admin = true where id = '<your-user-id>';
   ```

4. Refresh the app. `/admin` is now accessible from the hamburger menu.

Non-admins (including signed-out users) get redirected to `/`.

## Design notes

The design is paper-and-Scrabble — no dark mode, no glow, no emoji. All design tokens live in `src/index.css` `:root`. Paper utilities are `.paper-bg` / `.notebook-lines` / `.margin-line` / `.paper-card` / `.btn-paper`. Tiles are real wooden Scrabble tiles with Roboto Slab letters and a built-in point value (see `src/lib/tilePoints.ts`).
