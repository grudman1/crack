# CRACK — handoff for a fresh Claude Code chat

You're picking up a Vite/React/TypeScript app called **Crack** — a name-initials game. Read this once; you'll have the lay of the land. Drill into the specific files I point at as needed.

- **Live:** https://crack-black.vercel.app
- **Repo:** github.com/grudman1/crack (private)
- **Default branch:** `main`. Vercel auto-deploys on push. Supabase auto-applies SQL files in `supabase/migrations/` on push to `main`.

---

## 1. What it does, briefly

Every round generates **26 pairs of initials**: column A is `A…Z`, column B is the first 26 letters of a randomly-chosen famous phrase. For each pair, the player types a famous person whose initials match. Two modes:

- **Solo** — timed round, each typed answer validated against Wikipedia. 10 points / valid match.
- **Multiplayer** — host creates a 6-letter room code, players submit privately, then peer-vote on each other's answers (no validator in MP — humans are the referee).

The hard part — and 90% of the interesting code — is the **validator**: turning "is `Robin Thicke` a famous person with initials R·T?" into a deterministic answer using Wikipedia + Wikidata.

---

## 2. Stack

Vite 8 · React 19 · TypeScript · Tailwind v3 · shadcn/ui primitives (Dialog, Accordion, Progress) · Framer Motion · react-router-dom 7 · @supabase/supabase-js · sonner · lucide-react · double-metaphone · vitest. Vercel Analytics + Speed Insights are wired but zero-config (only collect on Vercel prod). No React Query (removed in `9fcd9dc` — the app is realtime-driven via Supabase channels).

---

## 3. Source layout

```
src/
  components/      Layout, ErrorBoundary, InitialsGrid, TimerBar, PhaseBanner,
                   PhraseHeader, ShareButton, SuggestionsPanel, EndRoundButton,
                   CrackMark, ExportButtons, AuthModal, TraceViewer, CopyBlock,
                   ReviewSubmitModal, ReviewQueueItem, ui/
  pages/           Index, Solo (+ Solo/{SoloSetup,SoloPlaying,SoloValidating,SoloResults}),
                   Multiplayer, Room, HowToPlay, NotFound, Admin
  services/        sentenceService, phraseService, wikiValidationService,
                   soloSuggestions, audioService, exportService,
                   roomService, reviewService, profileService, roundCounter, supabase
  hooks/           useAuth, useAdmin, useRealtime (generic), plus thin
                   wrappers useRoom / useRoomPlayers / useSubmissions /
                   useVotes / useScores / useReviews
  lib/             utils (cn), sanitizeError, share, clientFingerprint,
                   diagnoseTrace, traceFormat, reviewSnippets
  data/            famousPeople, phrases, regressionSet
  types/           database
supabase/
  migrations/
    0001_initial_schema.sql              (tables, RLS, compute_room_scores RPC, realtime)
    0002_validation_reviews.sql          (profiles.is_admin + validation_reviews + RLS)
    0003_add_remove_from_dataset.sql     (widens resolution_type allowlist)
scripts/
  runRegression.ts        node-side full regression set against live Wikipedia
  traceOne.ts             dump the validator trace for one (name, pair) input
  generateFamousPeople.ts (build-time, python+ts dataset refresh)
  generateRasters.ts      regenerate favicon/og PNGs from public/*.svg via sharp
  seedPhrases.py          wikiquote scraper for src/data/phrases.ts
  tsconfig.json           lets tsx resolve @/ aliases from the scripts dir
tests/
  components/, services/, lib/
```

**Routes** (see `src/App.tsx`):

| Path | What |
|---|---|
| `/` | Landing (`Index.tsx`) |
| `/solo` | Solo flow — orchestrator + four phase components |
| `/mp` | Multiplayer landing — name + Create/Join |
| `/mp/:roomCode` | Room — lobby/playing/validating/results |
| `/how` | How to play |
| `/admin` | Unified validator workspace (workbench + queue + regression) |
| `/debug` | Redirects to `/admin` preserving query params |
| `*` | NotFound |

The hamburger menu shows "Admin" only when `useAdmin().isAdmin === true`.

---

## 4. The validator (`src/services/wikiValidationService.ts`)

The single most important file. It's ~900 lines, internally documented, and shaped like a hard-gate-then-soft-chain:

**Hard gate (always strict):**
- Typed input must have first AND last token
- Typed initials must equal the round's expected pair (raw OR honorific-stripped — `Dame Judi Dench` → `JD` after stripping `Dame`)

**Soft chain (accept on first hit):**
- **a) local fast-path** — `FAMOUS_PEOPLE` (a curated map keyed by pair) with strict full-name fuzzy: full-name Lev ≤ 2, OR (same first name + surname Lev ≤ 2 / phonetic via double-metaphone)
- **b) Wikipedia exact-title** — `/page/summary/{title}`. Match = correct initials (raw or noble-suffix-stripped, e.g. `Prince Harry, Duke of Sussex` → `PH`), length-ratio ≥ 0.7 per token, person check ✓
- **c) prefix-with-connector** — opensearch top-3, accept if typed name is a strict prefix of a hit followed by a connector word (`Queen Noor` → `Queen Noor of Jordan`) + person check
- **d) disambig wikitext** — when (b) returned a disambiguation page, iterate its wikitext-ordered links
- **e) opensearch iterate** — typo-tolerant search; for each of the top-8 hits run the full check sequence (initials → ratio → surname-similarity → person-check); accept first that clears all

**Other moving parts in the file:**

- `computeNameInitials(name)` exported helper — first/last letters of the first and last name tokens
- `canonicalInitialsCandidates(title)` exported — returns both raw initials AND noble-suffix-stripped initials (so `"Prince Harry, Duke of Sussex"` yields `[PS, PH]`)
- `surnamesSimilar(a, b, maxLev = 2)` — Lev ≤ 2 OR phonetic (double-metaphone). The same threshold is propagated to the opensearch / prefix-connector / disambig stages via `surnameMatchesCanonical`
- `isPerson(summary)` — checks Wikidata P31 for Q5 (human) and a small FICTIONAL_QIDS set; falls back to extract heuristics ("born YYYY", "is a/an X") when Wikidata is unavailable
- Trace collector pattern — every chain stage emits `TraceRecord`s via an optional `trace` callback in `ValidateOptions`. Zero overhead in production (callsites pass no callback). The opensearch iterate stage emits **one structured record per hit** with a `detail.rejectedBy` / `qid` / `checks` payload that the admin queue's diagnoser reads.

**The summaryCache lesson** — case-sensitive Wikipedia REST paths mean `getSummary("robin thicke")` (404) and `getSummary("Robin Thicke")` (200) MUST be different cache entries. Don't normalize keys (see `63d5fe3` for the regression). Key by exact title; also cache under the post-redirect canonical title for dedup.

**What NOT to touch lightly:** the chain order, the early-exit semantics, the surname-similarity threshold, the noble-suffix regex. Any change to those should be validated against the regression set first.

---

## 5. The admin workspace (`/admin`)

Three vertically stacked sections in one page (`src/pages/Admin.tsx`):

**1. Test a name (workbench)**
Ad-hoc validator — name + pair → Run → full trace. Four action buttons after a Run resolve the test as a permanent queue entry via `submitAndResolveReview()` (see `src/services/reviewService.ts`). User comment is auto-set to `"self-tested via admin workbench"` so workbench-origin rows are distinguishable from player-origin.

The two "approve" slots are contextual: invalid result → `fix_validator` + `add_to_dataset`; valid result → `fix_validator` + `remove_from_dataset`.

After resolution, a `CopyBlock` shows the right snippet (regression test entry / FAMOUS_PEOPLE add line / FAMOUS_PEOPLE remove line). Snippet builders live in `src/lib/reviewSnippets.ts` and are shared with `ReviewQueueItem`.

**2. Queue**
`ReviewQueueItem`s in tabs: Pending / Approved / Rejected / Duplicate (live counts from `useReviews()`). Each row has:
- Diagnostic block (output of `src/lib/diagnoseTrace.ts` — a heuristic that reads the trace and suggests where the bug is)
- Trace expander (renders via `TraceViewer`)
- "Test this" → populates workbench inputs + smooth-scrolls + focuses
- "Re-run validation" → revalidates with `bypassCache: true`, overlays the new trace inline, shows an orange "result changed" badge if the verdict flipped
- 4 resolution buttons (same contextual logic as the workbench) → resolveReview → snippet appears

**3. Regression set**
Collapsed by default. "Run regression set" iterates `data/regressionSet.ts` cases against live Wikipedia. "Copy report as Markdown" dumps a pasteable summary. Toggle "Show details" to see per-case rows with expandable traces.

**Player-facing flow** (the source of queue rows):
- Solo results screen shows a `?` icon next to invalid rejection reasons AND accepted rows (symmetric — players can flag false positives too)
- Click `?` → `ReviewSubmitModal` (copy adapts based on `actualResult: 'valid' | 'invalid'`)
- Submit → row enters the queue as `status: 'pending'`
- Submitted rows get a muted "Submitted ✓" badge on subsequent renders (persisted in `localStorage['crack:submitted_reviews']`, keyed by `name|pair`)

---

## 6. Multiplayer

**Anonymous auth** (shipped in `7d505b0`):
- `/mp` and `/mp/<code>` never gate on email/password. Players type a name → `signInAnonymously(name)` → real `auth.uid()` → all RLS policies just work
- Display name lands in `raw_user_meta_data`; the existing `handle_new_user` trigger reads it when inserting the profile row
- Email/password sign-up is still available in the hamburger as an upgrade path; Supabase auto-promotes the anonymous account when the player signs up

**Requires:** Supabase Dashboard → Authentication → Providers → Anonymous Sign-Ins must be ON. If you see toasts mentioning anonymous auth on `Create room` / `Join`, the toggle's off.

**Room flow (`src/pages/Room.tsx`):**
- Anonymous deep-link visitors see an inline "Join this room" prompt instead of a sign-in wall
- Lobby polish: `Share the code with someone to start.` (when 1 player) + `Need at least one more player.` (when start is disabled)
- **Autosave per row** during playing: 600ms debounce per row index, flushes on phase change / unmount / `beforeunload`. No Save button, no "Saving…" UI
- **Progress strip** between TimerBar and InitialsGrid: shows each player's `N/26` submission count in real time. "You" is bold ink; others muted. Hidden when alone in the room
- Validating phase filters blank submissions from voting (autosave can record empty rows when a player types-then-deletes)
- Results: leaderboard + `Your breakdown` (Accordion) + `ShareButton` with MP-flavored text (`Crack · MP · Round #N · 2nd of 4`, three glyphs — 🟧 valid / ⬜ invalid / `·` blank)

**Realtime hooks (`src/hooks/useRealtime.ts`):**
Two generic hooks — `useRealtimeRow<T>` (single-row, used by `useRoom`) and `useRealtimeTable<T>` (collections — used by everything else). All six existing hooks (`useRoom`, `useRoomPlayers`, `useSubmissions`, `useVotes`, `useScores`, `useReviews`) are thin wrappers. `useRoomPlayers` and `useReviews` pass a custom `loadFn` to do server-side filtering / in-memory joins.

---

## 7. Solo orchestrator + phase components

`src/pages/Solo.tsx` owns all state + effects (timer, runValidation, modal lifecycle, derived memos). The four phase views are pure-ish components in `src/pages/Solo/`:

```
SoloSetup       totalSeconds + setter + onStart
SoloPlaying     round + remaining + rows + onChange + onEnd
SoloValidating  round + progress + rows
SoloResults     round + rows + counters + onPlayAgain + onSubmitForReview
                  + submittedReviewKeys
```

The orchestrator switches over `phase` and renders the right component. The review modal is a sibling rendered when `reviewModalRow !== null`.

---

## 8. Dev workflow

```sh
npm run dev         # localhost:5174
npm run build       # tsc -b && vite build
npm run preview     # serve dist
npm run test        # vitest run
npm run lint        # ESLint
npm run gen-rasters # regenerate favicon/og PNGs from public/*.svg

# Dev-only scripts (under scripts/)
npx tsx scripts/runRegression.ts                  # full regression set vs live Wikipedia (Node)
npx tsx scripts/traceOne.ts "Prince Harry" PH     # single-case trace dump
```

`TSX_TSCONFIG_PATH=scripts/tsconfig.json` is sometimes needed when running scripts/ files that import `@/` paths from Node. The current scripts work without it because tsx picks it up automatically.

**Testing patterns to follow:**
- Pure logic tests in `tests/lib/` and `tests/services/`
- Component smoke tests in `tests/components/`
- For Supabase-touching service tests, mock the supabase client with a thenable builder (see `tests/services/reviewService.test.ts` for the pattern)
- For validator tests with mocked fetch (URL encoding, case-collision), see `tests/services/wikiValidationService.test.ts`

**Smoke-test bypass pattern:** when verifying the `/admin` workspace in dev preview (no auth), I temporarily swap `useAdmin()` for `{ isAdmin: true, loading: false }` at the top of `Admin.tsx`, screenshot, then revert. Always revert before commit. Grep for `TEMP smoke-test bypass` to catch leftover bypasses.

---

## 9. Commit + push conventions

- **Conventional Commits prefixes**: `feat`, `fix`, `chore`, `docs`. Recent log is the best guide (see `git log --oneline -20`).
- **Subject lines** are descriptive, not branchy. "feat(admin): merge /debug + /admin into a single validator workspace" not "fix admin page".
- **Bodies are long and explain WHY**. The history reads like a changelog — that's deliberate.
- **Always include** the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer. Use a HEREDOC for the commit message so newlines render correctly.
- **Stage explicitly** by listing files, not `git add .` or `-A`. There are three stray untracked files (`crack@0.0.0`, `repomix-output.xml`, `vite`) that should NOT be committed — they're artifacts from unrelated tools. Leave them untracked.
- **"Hold for review"** — the user often asks for a report + paste before pushing. When they're being deliberate about a risky change ("Don't push until X passes"), respect that literally. After they say "commit and push" or "push it", proceed.
- Sometimes the user wants to see a screenshot or live trace before push. Use the preview tools to capture.

---

## 10. Known issues / loose ends

- **Frank Corsair regression case** (`src/data/regressionSet.ts`) is intentionally listed as a known failure. Frank Corsaro is a real Wikipedia-documented person; `Lev('corsair', 'corsaro') = 2`, within the surname-similarity threshold (Lev ≤ 2 is universal in the chain — same threshold used for legitimate typos like Reasner ↔ Reasoner). Fixing it requires either tightening to Lev ≤ 1 (rejects other 2-char typos) or adding a fame floor (separate work). Comment in the file explains.
- **Bundle warning** (`> 500 kB after minification`) is informational only. We're at ~2 MB raw / ~635 kB gzip. Code splitting is a future cleanup, not blocking.
- **Stray files**: `crack@0.0.0`, `repomix-output.xml`, `vite` — untracked artifacts from earlier tooling experiments. Safe to delete with `rm`, never commit.
- **`getSummary` HTTP status** — when a fetch returns 4xx/5xx, we cache `null` and lose the actual status code. The per-iteration trace can show `summaryStatus` but currently we synthesize it (200 if got summary, undefined otherwise). If you need the real status, refactor `getSummary` to return `{ summary, status }`.

---

## 11. Patterns to follow

- **Trace collector** — every chain stage in the validator accepts an optional `trace` callback. When adding a new stage or check, emit a `TraceRecord` so the admin diagnoser can read it. See `TraceRecord` type in `wikiValidationService.ts`.
- **Generic hooks first** — if you need realtime data, wrap `useRealtimeRow` or `useRealtimeTable`. Don't write a new `useEffect + supabase.channel` block.
- **Service helpers stay pure** — `lib/reviewSnippets.ts`, `lib/diagnoseTrace.ts`, `lib/share.ts`, `lib/traceFormat.ts` all take primitives and return strings or values. Easy to test, easy to call from multiple places.
- **ErrorBoundary scopes to `<main>`** — a thrown render in a routed page shows a fallback while the header stays mounted. Don't catch errors via try/catch in components; let them propagate.
- **No new dependencies casually** — the recent code-health pass removed React Query. The bar is high. If you need something, propose it before installing.

---

## 12. Quick "what's where" map

| Need to… | Look at |
|---|---|
| Change how validation works | `src/services/wikiValidationService.ts` |
| Add a regression test case | `src/data/regressionSet.ts` |
| Add a diagnoser heuristic | `src/lib/diagnoseTrace.ts` |
| Change the admin page | `src/pages/Admin.tsx` |
| Change Solo flow | `src/pages/Solo.tsx` + `src/pages/Solo/` |
| Change MP room | `src/pages/Room.tsx` |
| Add a realtime table hook | `src/hooks/useRealtime.ts` + thin wrapper |
| Add a snippet generator | `src/lib/reviewSnippets.ts` |
| Change RLS or schema | `supabase/migrations/00XX_…sql` (new file, never edit old ones) |
| Refresh icons / OG images | edit `public/*.svg` then `npm run gen-rasters` |
| Refresh phrases dataset | `scripts/seedPhrases.py` (writes `src/data/phrases.ts`) |
| Refresh famous-people dataset | `scripts/generateFamousPeople.ts` (writes `src/data/famousPeople.ts`) |

---

## 13. Recent commit history (high-level)

```
c00d291  fix(ui): selected pill highlight persists when focus leaves the button
63d5fe3  fix(validator): summaryCache no longer collapses case-variants of the same title
6e4cf27  feat(validator): per-iteration trace records in opensearch + URL audit
289f74f  feat(mp): tier 1 fixes — autosave, progress strip, blank filter, share, accordion
7d505b0  feat(mp): anonymous Supabase auth — multiplayer no longer requires sign-in
086ffe9  chore: PNG raster pipeline, Vercel telemetry, diagnoseTrace wording
bcd2b7e  feat(admin): merge /debug + /admin into a single validator workspace
9fcd9dc  chore: code health pass — generic realtime hooks, Solo split, ErrorBoundary, drop React Query
7cc932f  fix(validation): require surname similarity in opensearch / disambig / prefix-connector stages
8084100  fix(diagnose): split rule 4/5 by matching-initials filter
39e6b45  feat(admin): symmetric flag — players can also flag wrongly-accepted rows
c98aa4e  feat(admin): player feedback triage queue at /admin
b0cfffa  feat(debug): /debug page + validator trace; honorific/noble-suffix strips
```

When the user references "the symmetric flag feature" or "the case-collision bug", grep the commits — there's usually a single SHA that explains the full context.

---

## 14. First actions in a fresh chat

1. `git status` — confirm clean tree
2. `git log --oneline -10` — orient
3. `npm test` — confirm 68/68 passing (or higher if more tests were added since)
4. Read `src/services/wikiValidationService.ts` end-to-end (it's the single most consequential file)
5. Read `src/pages/Admin.tsx` (the workspace's three-section orchestration is the second most)
6. Glance at `src/data/regressionSet.ts` (you'll see what counts as "real" validator behavior)

Then you're ready for whatever the user throws at you.
