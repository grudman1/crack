// Heuristic post-mortem for a validation trace. Reads the trace records
// emitted by validateName() and tries to identify which stage is the
// most likely culprit + whether the right fix is code (validator bug)
// or data (FAMOUS_PEOPLE override).
//
// This is a triage helper, not a diagnostic tool — it surfaces a single
// best-guess hint per submission. An admin still reads the full trace
// before deciding.

import type { TraceRecord } from '@/services/wikiValidationService';

export interface TraceDiagnosis {
  likelyCause: 'validator_bug' | 'wikipedia_ambiguity' | 'unknown';
  hint: string;
  suspectedStage?: TraceRecord['stage'];
  suggestedAction: 'fix_validator' | 'add_to_dataset';
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

export function diagnoseTrace(trace: TraceRecord[]): TraceDiagnosis {
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

  // --- 4. Opensearch returned 0 hits (or every reported hit is
  //         clearly unrelated). Wikipedia genuinely doesn't index this
  //         person — override via FAMOUS_PEOPLE.
  const opensearchInfo = findStage(trace, 'opensearch').find(
    (r) => r.outcome === 'info' && r.label.toLowerCase().startsWith('opensearch'),
  );
  if (opensearchInfo) {
    const hits = (opensearchInfo.detail as Record<string, unknown> | undefined)?.['hits'];
    if (Array.isArray(hits) && hits.length === 0) {
      return {
        likelyCause: 'wikipedia_ambiguity',
        hint: "Wikipedia search returned no hits for this name. The validator can't help here — curate via FAMOUS_PEOPLE.",
        suspectedStage: 'opensearch',
        suggestedAction: 'add_to_dataset',
      };
    }
  }

  // --- 5. Opensearch iterated, every candidate failed downstream. The
  //         article exists but the chain rejects it.
  const opensearchMisses = findStage(trace, 'opensearch').filter((r) => r.outcome === 'miss');
  const opensearchHits = findStage(trace, 'opensearch').filter((r) => r.outcome === 'hit');
  if (opensearchMisses.length > 0 && opensearchHits.length === 0) {
    return {
      likelyCause: 'validator_bug',
      hint: 'Opensearch surfaced candidates but every downstream check rejected them. Inspect the per-iteration trace to see whether the initials, length-ratio, or person check is the culprit.',
      suspectedStage: 'opensearch',
      suggestedAction: 'fix_validator',
    };
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

  // --- 8. Fallback.
  return {
    likelyCause: 'unknown',
    hint: 'No specific pattern detected. Review the full trace manually.',
    suggestedAction: 'fix_validator',
  };
}
