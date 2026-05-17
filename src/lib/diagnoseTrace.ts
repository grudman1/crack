// Heuristic post-mortem for a validation trace. Reads the trace records
// emitted by validateName() and tries to identify which stage is the
// most likely culprit + whether the right fix is code (validator bug)
// or data (FAMOUS_PEOPLE override).
//
// This is a triage helper, not a diagnostic tool — it surfaces a single
// best-guess hint per submission. An admin still reads the full trace
// before deciding.

import {
  canonicalInitialsCandidates,
  type TraceRecord,
} from '@/services/wikiValidationService';

export interface TraceDiagnosis {
  likelyCause: 'validator_bug' | 'wikipedia_ambiguity' | 'unknown';
  hint: string;
  suspectedStage?: TraceRecord['stage'];
  suggestedAction: 'fix_validator' | 'add_to_dataset' | 'remove_from_dataset';
}

function findStage(trace: TraceRecord[], stage: TraceRecord['stage']): TraceRecord[] {
  return trace.filter((r) => r.stage === stage);
}

/** Returns the canonical title initials embedded in the exact-stage
 *  miss note. Records look like:
 *    `"Prince Harry, Duke of Sussex" — initials PS ✗, ratio ✓, person ...`
 *  We pull "PS" (or "PS/PH") out of that note. Returns null if not found. */
function extractExactInitials(r: TraceRecord): string | null {
  const m = r.note.match(/initials\s+([A-Z][A-Z/]*?)\s+(?:✗|✓)/);
  return m ? m[1] ?? null : null;
}

function exactHadInitialsMiss(r: TraceRecord): boolean {
  return /initials\s+[A-Z][A-Z/]*\s+✗/.test(r.note);
}

function exactHadRatioMiss(r: TraceRecord): boolean {
  return /ratio\s+✗/.test(r.note);
}

function exactHadPersonMiss(r: TraceRecord): boolean {
  return /person\s+✗/.test(r.note);
}

/** Was a wikibase_item Q-ID surfaced in the exact stage's detail? */
function exactHadWikibaseId(r: TraceRecord): boolean {
  const wbid = (r.detail as Record<string, unknown> | undefined)?.['wikibase_item'];
  return typeof wbid === 'string' && wbid.length > 0;
}

/** Try to recover the round's expected pair from gate trace notes
 *  ("typed initials PH match expected PH" / "expected SP, got SM").
 *  Lets callers omit the explicit pair and still get a correct
 *  matching-initials filter in pattern 4/5. */
function parseExpectedPair(trace: TraceRecord[]): string | null {
  for (const r of trace) {
    if (r.stage !== 'gate') continue;
    const m = r.note.match(/expected\s+([A-Z]{2})/);
    if (m) return m[1]!;
  }
  return null;
}

export function diagnoseTrace(
  trace: TraceRecord[],
  expectedPair?: string,
): TraceDiagnosis {
  // --- 1. Exact-stage initials mismatch where a stripped candidate
  //         (form "RAW/STRIPPED") existed but neither matched. This is
  //         the same family of bug we fixed with stripCanonicalNobleSuffix
  //         — a future case that the regex still doesn't catch will
  //         show as e.g. "initials AB/CD ✗".
  const exactRows = findStage(trace, 'exact');
  for (const r of exactRows) {
    if (r.outcome !== 'miss') continue;
    if (!exactHadInitialsMiss(r)) continue;
    const inits = extractExactInitials(r);
    if (inits && inits.includes('/')) {
      return {
        likelyCause: 'validator_bug',
        hint: `Title-stripping computed candidates ${inits} but none matched the expected pair. Extend stripCanonicalNobleSuffix() in wikiValidationService.ts to cover this title pattern.`,
        suspectedStage: 'exact',
        suggestedAction: 'fix_validator',
      };
    }
  }

  // --- 2. Exact-stage found an article with a wikibase Q-ID but
  //         person-check rejected it. Likely a P31 path missing Q5 — or
  //         FICTIONAL_QIDS firing on a real person.
  for (const r of exactRows) {
    if (r.outcome !== 'miss') continue;
    if (!exactHadPersonMiss(r)) continue;
    if (!exactHadWikibaseId(r)) continue;
    return {
      likelyCause: 'validator_bug',
      hint: 'Person-check rejected a Wikidata-tagged entity. Check isPerson() — likely missing a P31 → Q5 path or a FICTIONAL_QIDS false-positive.',
      suspectedStage: 'exact',
      suggestedAction: 'fix_validator',
    };
  }

  // --- 3. Exact-stage initials ✓ but length-ratio gate killed it.
  for (const r of exactRows) {
    if (r.outcome !== 'miss') continue;
    if (exactHadInitialsMiss(r)) continue;
    if (exactHadRatioMiss(r)) {
      return {
        likelyCause: 'validator_bug',
        hint: 'Length-ratio gate rejected a matching article. Investigate the LENGTH_RATIO_THRESHOLD / wordLengthRatioOK behavior for this name pattern.',
        suspectedStage: 'exact',
        suggestedAction: 'fix_validator',
      };
    }
  }

  // --- 4 / 5. Opensearch ran. Split by whether ANY of the surfaced hits
  //             have canonical initials matching the round's pair.
  //
  //   - 0 matching-initial hits → Wikipedia search didn't find the
  //     person at all (or only surfaced same-search-term articles for
  //     unrelated people). The validator did nothing wrong; the right
  //     fix is dataset curation, not a code change.
  //   - ≥1 matching-initial hit, all rejected downstream → the chain
  //     had a real candidate to validate but its downstream checks
  //     rejected it. Real validator bug.
  //
  //  When the pair can't be recovered from the trace, treat hits as
  //  "unknown" and fall back to a hits-count check so we still split
  //  the 0-hits-total case cleanly.
  const opensearchInfo = findStage(trace, 'opensearch').find(
    (r) => r.outcome === 'info' && r.label.toLowerCase().startsWith('opensearch'),
  );
  if (opensearchInfo) {
    const hits = (opensearchInfo.detail as Record<string, unknown> | undefined)?.['hits'];
    const hitList = Array.isArray(hits)
      ? hits.filter((h): h is string => typeof h === 'string')
      : [];
    const pair = (expectedPair ?? parseExpectedPair(trace) ?? '').toUpperCase();
    const matchingHits = pair
      ? hitList.filter((h) => canonicalInitialsCandidates(h).includes(pair))
      : null;
    const noMatchingHits =
      matchingHits !== null ? matchingHits.length === 0 : hitList.length === 0;

    if (noMatchingHits) {
      return {
        likelyCause: 'wikipedia_ambiguity',
        hint: "Wikipedia search didn't surface a person with these initials. The person may not be famous enough to have an article, or Wikipedia's data is sparse. Verify before adding to dataset.",
        suspectedStage: 'opensearch',
        suggestedAction: 'add_to_dataset',
      };
    }

    // Inspect per-iteration records (added in the trace rewrite —
    // each iterated hit emits one record with detail.rejectedBy).
    // Cluster the rejection reasons; when every iteration died for
    // the same reason we can be more specific than the catch-all
    // "downstream rejected" diagnosis below.
    const iterationRecords = findStage(trace, 'opensearch').filter(
      (r) => r.outcome === 'miss' && r.label.toLowerCase().startsWith('iterate:'),
    );
    if (iterationRecords.length > 0) {
      const rejectedByList = iterationRecords.map(
        (r) => (r.detail as Record<string, unknown> | undefined)?.['rejectedBy'] as string | undefined,
      );
      const qidList = iterationRecords.map(
        (r) => (r.detail as Record<string, unknown> | undefined)?.['qid'] as string | undefined,
      );

      const allPersonRejected = rejectedByList.every((rb) => rb === 'person');
      const allMissingQid = qidList.every((q) => !q);
      if (allPersonRejected && allMissingQid) {
        return {
          likelyCause: 'validator_bug',
          hint: 'Every iteration was rejected by the person-check with no wikibase_item returned. Likely an API-response shape problem — possibly browser/CORS or an upstream Wikipedia change. Inspect devtools Network for the /page/summary response.',
          suspectedStage: 'opensearch',
          suggestedAction: 'fix_validator',
        };
      }

      // "All rejected by the name-similarity gate" — either first
      // name or surname mismatch on every iteration. After the
      // first-name pin was added (laurie clayton / alex newton bug),
      // first-name failures are their own rejectedBy bucket; group
      // them with surname for this cluster pattern since the
      // diagnostic action is the same.
      const allNameRejected = rejectedByList.every(
        (rb) => rb === 'firstName' || rb === 'surname',
      );
      if (allNameRejected) {
        const allFirstName = rejectedByList.every((rb) => rb === 'firstName');
        const hint = allFirstName
          ? 'Every opensearch candidate cleared initials + ratio but its first name differed from the typed input. Probably no real article exists for the typed person — verify before adding to dataset.'
          : 'Every opensearch candidate cleared initials + ratio but failed the name-similarity gate (first name and/or surname). Threshold may be too tight, OR no genuine match exists in the top opensearch hits.';
        return {
          likelyCause: 'validator_bug',
          hint,
          suspectedStage: 'opensearch',
          suggestedAction: 'fix_validator',
        };
      }
    }

    const opensearchMisses = findStage(trace, 'opensearch').filter((r) => r.outcome === 'miss');
    const opensearchHits = findStage(trace, 'opensearch').filter((r) => r.outcome === 'hit');
    if (opensearchMisses.length > 0 && opensearchHits.length === 0) {
      return {
        likelyCause: 'validator_bug',
        hint: 'Opensearch surfaced candidates with matching initials, but downstream checks (length ratio, person, surname similarity) rejected them. Inspect the per-iteration trace to identify which check is the culprit.',
        suspectedStage: 'opensearch',
        suggestedAction: 'fix_validator',
      };
    }
  }

  // --- 6. Disambig page iterated but every candidate failed
  //         person-check.
  const disambigMiss = findStage(trace, 'disambig').find((r) => r.outcome === 'miss');
  if (disambigMiss) {
    return {
      likelyCause: 'validator_bug',
      hint: 'Disambig handling iterated all candidates but none cleared the person-check. Check getDisambigLinks() ordering and isPerson() coverage.',
      suspectedStage: 'disambig',
      suggestedAction: 'fix_validator',
    };
  }

  // --- 7. Gate rejected on initials mismatch. Real mismatch, not a
  //         chain bug — player typed the wrong initials.
  const gateMiss = findStage(trace, 'gate').find(
    (r) => r.outcome === 'miss' && /^expected\s+[A-Z]{2},\s*got/.test(r.note),
  );
  if (gateMiss) {
    return {
      likelyCause: 'unknown',
      hint: 'Initials mismatch at the gate — the typed name does not match the pair at all. Most likely a valid rejection (player error).',
      suspectedStage: 'gate',
      suggestedAction: 'add_to_dataset',
    };
  }

  // The remaining rules cover ACCEPTANCE traces — the reviewer flagged
  // a row that the chain validated as a real person but they think
  // shouldn't have counted. These never match a trace that ended in
  // rejection, so order vs. rules 1-7 above is moot.
  const wasAccepted = trace.some(
    (r) => r.stage === 'final' && /^accept/i.test(r.label),
  );

  if (wasAccepted) {
    // --- 9. Accepted via the exact stage but on a thin signal —
    //         specifically, person ✓ but no wikibase_item in the detail
    //         payload. Wikidata didn't tag the article with Q5, so we
    //         must have leaned on the extract-text heuristic in
    //         isPerson(). Likely a false positive (notable place,
    //         organization, fictional thing, etc.).
    const exactHit = exactRows.find((r) => r.outcome === 'hit');
    if (exactHit) {
      const wbid = (exactHit.detail as Record<string, unknown> | undefined)?.['wikibase_item'];
      const hasWikibaseId = typeof wbid === 'string' && wbid.length > 0;
      if (!hasWikibaseId) {
        return {
          likelyCause: 'validator_bug',
          hint: 'Person-check accepted on a weak signal (no Wikidata Q5 — fell back to extract heuristics). Tighten isPerson() so heuristic-only acceptances require a stronger biographical opener.',
          suspectedStage: 'exact',
          suggestedAction: 'fix_validator',
        };
      }
    }

    // --- 10. Accepted via opensearch iteration. The hard chain
    //          (exact-title) didn't match, so we fell back to fuzzy
    //          search. If the reviewer flagged this as wrong, the
    //          matched article is probably a niche figure whose name
    //          collides with the typed one — needs a prominence floor
    //          (pageviews, Q-rank, etc.) rather than first-eligible-hit.
    const opensearchHit = findStage(trace, 'opensearch').find(
      (r) => r.outcome === 'hit' && r.label.toLowerCase().includes('iterate'),
    );
    if (opensearchHit) {
      return {
        likelyCause: 'validator_bug',
        hint: 'Opensearch iterate matched a candidate the chain considered eligible, but the reviewer disagrees. Consider raising the prominence threshold or surfacing top pageviews/Q-rank before iterating.',
        suspectedStage: 'opensearch',
        suggestedAction: 'fix_validator',
      };
    }

    // --- 11. Accepted via the local fast-path (FAMOUS_PEOPLE). The
    //          chain never reached Wikipedia — the entry is curated
    //          local data. If the reviewer says this is wrong, the
    //          entry itself is the problem; suggest deletion.
    const localHit = findStage(trace, 'local').find((r) => r.outcome === 'hit');
    if (localHit) {
      return {
        likelyCause: 'unknown',
        hint: 'Bad entry in FAMOUS_PEOPLE — the local fast-path matched this name without consulting Wikipedia. Remove or correct the entry.',
        suspectedStage: 'local',
        suggestedAction: 'remove_from_dataset',
      };
    }
  }

  // --- 8. Fallback.
  return {
    likelyCause: 'unknown',
    hint: 'No specific pattern detected. Review the full trace manually.',
    suggestedAction: 'fix_validator',
  };
}
