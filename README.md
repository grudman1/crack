# CRACK — the name game

A browser-based "initials game". Every round generates 26 pairs of initials (A–Z paired with the first 26 letters of a famous phrase). For each pair, name a famous person whose initials match. Wikipedia + Wikidata is the referee.

Two modes:
- **Solo** — timed round, each answer validated against Wikipedia. 10 points per valid match.
- **Multiplayer** — host creates a 6-char room code, players submit privately, then vote on each other's answers. 10 points for valid + unique, 5 for valid + duplicated.

## Stack

Vite 8 · React 19 · TypeScript · Tailwind v3 · shadcn/ui primitives (Dialog, Accordion, Progress) · Framer Motion · react-router-dom 7 · @supabase/supabase-js · sonner · lucide-react · double-metaphone · vitest

## Scripts

```sh
npm run dev      # Vite dev server on http://localhost:5174
npm run build    # tsc -b && vite build → dist/
npm run preview  # Serve dist locally
npm run test     # Run vitest once
npm run lint     # ESLint
```

Two dev-only utilities under `scripts/`:

```sh
npx tsx scripts/runRegression.ts                  # Run the full validator regression set
                                                  # against the live Wikipedia API. Emits
                                                  # a Markdown report to stdout.
npx tsx scripts/traceOne.ts "Prince Harry" PH     # Dump the validator trace for one input.
```

## Project structure

```
src/
  components/        Layout, ErrorBoundary, InitialsGrid, TimerBar, PhaseBanner,
                     PhraseHeader, ShareButton, SuggestionsPanel, EndRoundButton,
                     CrackMark, ExportButtons, AuthModal, TraceViewer,
                     ReviewSubmitModal, ReviewQueueItem, ui/
  pages/             Index, Solo (+ Solo/{SoloSetup,SoloPlaying,SoloValidating,SoloResults}),
                     Multiplayer, Room, HowToPlay, NotFound, Debug, Admin
  services/          sentenceService, phraseService, wikiValidationService,
                     soloSuggestions, audioService, exportService,
                     roomService, reviewService, roundCounter, supabase
  hooks/             useAuth, useAdmin, useRealtime (generic), plus thin
                     wrappers: useRoom, useRoomPlayers, useSubmissions,
                     useVotes, useScores, useReviews
  lib/               utils (cn), sanitizeError, share, clientFingerprint,
                     diagnoseTrace, traceFormat
  data/              famousPeople, phrases, regressionSet
  types/             database
supabase/
  migrations/
    0001_initial_schema.sql
    0002_validation_reviews.sql
    0003_add_remove_from_dataset.sql
scripts/             runRegression.ts, traceOne.ts, generateFamousPeople.ts,
                     seedPhrases.py
tests/
  components/, services/, lib/
```

## Setup

1. Copy `.env.example` to `.env.local` and fill in your Supabase URL and anon key.
2. Apply the migrations in `supabase/migrations/` in order. In the Supabase SQL Editor, paste each file's contents and run. (Or `supabase db push` if you have the CLI configured.)
   - `0001_initial_schema.sql` — tables, RLS, `compute_room_scores` RPC, realtime publications.
   - `0002_validation_reviews.sql` — `validation_reviews` table + `profiles.is_admin` for the moderation queue.
   - `0003_add_remove_from_dataset.sql` — widens the resolution-type allowlist.
3. (Optional) Promote yourself to admin — see "Admin setup" below.
4. (Optional) Regenerate strict types: `npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/database.ts`.
5. `npm run dev`.

Solo mode works without Supabase configured — you'll only need it for Multiplayer + the admin queue.

## Admin setup

The `/admin` route is a moderation queue for player-submitted validator feedback. Gated on `profiles.is_admin`.

1. Sign in to the app (any account).
2. Find your user ID in Supabase → Authentication → Users (the UUID column).
3. In Supabase SQL Editor:

   ```sql
   update public.profiles set is_admin = true where id = '<your-user-id>';
   ```

4. Refresh the app. "Admin" appears in the hamburger menu.

Non-admins (including signed-out users) get redirected to `/`.

## Debug tools

- **`/debug`** — internal validator inspector. Three sections: an ad-hoc validator (name + pair → full per-stage trace), the regression set runner (hardcoded ACCEPT/REJECT cases with click-to-expand traces), and a copy-as-Markdown report. Not linked from anywhere; `<meta name="robots" content="noindex,nofollow">` is set on mount.
- **`/admin`** — moderation queue. Players flag rejected (and accepted) rows from the Solo results screen via a `?` icon; submissions land here. Each row carries a heuristic diagnostic (`src/lib/diagnoseTrace.ts`) suggesting which validator stage to inspect, plus copy-pasteable snippets for the regression set / `FAMOUS_PEOPLE` / removal.

## Design notes

NYT Games-family aesthetic: warm white background (`#fbf8ed`), Georgia serif headlines, Helvetica body, pill-shaped primary buttons, hairline borders, no shadows or glow. The accent is orange `#e8743b` (a single highlight color for letter pairs, share-grid wins, and active state). Success is muted green `#6aaa64`; error is muted red. Design tokens live in `src/index.css` `:root`. Utility classes: `.frame` (page-width container), `.btn-primary` / `.btn-pill-sm` (button system), `.input-line` (text inputs), `.viewport-center` (safe-area vertical centering).

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import into Vercel; `vercel.json` already sets framework, build command, output dir, and the SPA rewrite (`/* → /index.html`).
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel's environment variables (Production, Preview, Development).
4. After the first deploy, add the Vercel preview URL to Supabase → Authentication → URL Configuration so email confirmation links work in production.
5. Migrations in `supabase/migrations/*.sql` auto-apply via the Supabase GitHub integration on push to `main`.
