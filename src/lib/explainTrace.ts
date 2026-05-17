// Translate a validator TraceRecord[] into a human-readable explanation
// for the post-round "submit for review" modal.
//
// Pure: no network, no React, no DOM. The modal layer decides what to
// fetch (Wikipedia summary for accepted matches, FAMOUS_PEOPLE description
// for local hits) based on the returned `kind` and `canonical` fields.
//
// The trace shape is the source of truth — every chain stage emits at
// least one record, and the explainer walks them in order to decide
// which case applies. When two cases could plausibly fit (e.g. exact-
// match-but-fictional vs. opensearch-iterate-rejected-similar), the
// earlier accept-path one wins, mirroring the validator chain.

import type { TraceRecord } from '@/services/wikiValidationService';

export type ExplainKind =
  // Accepted — the modal pairs these with either a FAMOUS_PEOPLE
  // description lookup or a Wikipedia summary fetch.
  | 'accepted-local'
  | 'accepted-exact'
  | 'accepted-fuzzy'
  // Rejected — the modal renders the precomputed copy as-is.
  | 'rejected-initials-mismatch'
  | 'rejected-no-page'
  | 'rejected-fictional'
  | 'rejected-not-person'
  | 'rejected-different-person'
  | 'rejected-disambig'
  | 'rejected-unknown';

export interface Explanation {
  kind: ExplainKind;
  /** Canonical Wikipedia title for accepted cases and for rejected cases
   *  where we landed on a specific (wrong) page — e.g. fictional/place. */
  canonical?: string;
  /** Up to two closest-match candidates for rejected-different-person. */
  closestCandidates?: string[];
  /** What the typed name's initials computed to (for the gate-miss case). */
  typedInitials?: string;
  /** Expected pair carried through to the rejected-initials case. */
  expectedPair?: string;
  /** Person-kind hint from the validator for the rejected-not-person case
   *  (so the modal can say "place" vs "organization" if it wants). */
  personKind?: 'fictional' | 'other' | 'disambig' | 'unknown';
}

export interface ExplainContext {
  /** 'valid' or 'invalid' — the validator's final verdict. */
  status: 'valid' | 'invalid';
  /** The text the player typed (used for the initials-mismatch case). */
  typedName: string;
  /** The round letter pair, uppercased, e.g. "DT". */
  expectedPair?: string;
}

function recordsBy(
  trace: TraceRecord[],
  stage: TraceRecord['stage'],
  outcome?: TraceRecord['outcome'],
): TraceRecord[] {
  return trace.filter((r) => r.stage === stage && (outcome ? r.outcome === outcome : true));
}

export function explainTrace(trace: TraceRecord[], ctx: ExplainContext): Explanation {
  // --- accept paths first --------------------------------------------------
  if (ctx.status === 'valid') {
    // Local fast-path hit — preferred path; FAMOUS_PEOPLE has a curated
    // description so no Wikipedia fetch is needed at modal time.
    const localHit = trace.find((r) => r.stage === 'local' && r.outcome === 'hit');
    if (localHit) {
      const canonical =
        (localHit.detail?.['canonical'] as string | undefined) ?? undefined;
      return { kind: 'accepted-local', canonical };
    }
    // Exact Wikipedia title — the canonical is what they typed (or the
    // honorific-stripped variant). Modal fetches the summary on open.
    const exactHit = trace.find((r) => r.stage === 'exact' && r.outcome === 'hit');
    if (exactHit) {
      const canonical = (exactHit.detail?.['canonical'] as string | undefined) ?? undefined;
      return { kind: 'accepted-exact', canonical };
    }
    // 1-token redirect — also "exact-ish" from the player's perspective
    // (they typed an abbreviation that redirected to a full name); we
    // call it accepted-exact too so the modal copy is the same.
    const tokRedirect = trace.find((r) => r.stage === '1tok-redirect' && r.outcome === 'hit');
    if (tokRedirect) {
      const canonical = (tokRedirect.detail?.['canonicalTitle'] as string | undefined) ?? undefined;
      return { kind: 'accepted-exact', canonical };
    }
    // Anything fuzzy that still accepted — prefix-connector, disambig
    // iterate, opensearch iterate. Be honest with the player that the
    // typed input wasn't an exact match.
    const fuzzyHit =
      trace.find((r) => r.stage === 'prefix-connector' && r.outcome === 'hit') ??
      trace.find((r) => r.stage === 'disambig' && r.outcome === 'hit') ??
      trace.find((r) => r.stage === 'opensearch' && r.outcome === 'hit');
    if (fuzzyHit) {
      const canonical =
        (fuzzyHit.detail?.['canonical'] as string | undefined) ??
        (fuzzyHit.detail?.['canonicalTitle'] as string | undefined);
      return { kind: 'accepted-fuzzy', canonical };
    }
    // Edge case: status is valid but no hit record present (e.g. cache
    // replay without recapture). Fall through to unknown.
    return { kind: 'rejected-unknown' };
  }

  // --- reject paths --------------------------------------------------------

  // Gate Initials mismatch — the typed name's initials weren't the
  // expected pair. The validator emits a `gate / Initials / miss` record
  // with a note "expected XX, got YY" — parse the typed initials out of
  // that note so the explainer can quote them back to the player.
  const initialsMiss = trace.find(
    (r) => r.stage === 'gate' && r.outcome === 'miss' && /^Initials/i.test(r.label),
  );
  if (initialsMiss) {
    const m = initialsMiss.note.match(/got\s+([A-Z]{2}(?:\s*\/\s*[A-Z]{2})?)/);
    const typedInitials = m ? m[1]!.replace(/\s+/g, '') : undefined;
    return {
      kind: 'rejected-initials-mismatch',
      typedInitials,
      expectedPair: ctx.expectedPair,
    };
  }

  // Person-check rejection on the exact match — Wikipedia returned a
  // standard page but Wikidata said it isn't a person. Branch on the
  // person kind so the copy can distinguish fictional from place/org.
  const exactMisses = recordsBy(trace, 'exact', 'miss');
  for (const r of exactMisses) {
    const kind = r.detail?.['personKind'] as
      | 'human'
      | 'fictional'
      | 'disambig'
      | 'other'
      | 'unknown'
      | undefined;
    const canonical = r.detail?.['canonical'] as string | undefined;
    if (!canonical) continue;
    if (kind === 'fictional') {
      return { kind: 'rejected-fictional', canonical, personKind: 'fictional' };
    }
    if (kind === 'other') {
      return { kind: 'rejected-not-person', canonical, personKind: 'other' };
    }
  }

  // Exact match was a disambiguation page AND the disambig stage didn't
  // resolve to a person. The exact-stage miss notes "is a disambiguation
  // page", and the disambig stage emits its own miss.
  const exactDisambig = exactMisses.find((r) => /disambiguation/i.test(r.note));
  if (exactDisambig) {
    const disambigMissed = trace.some((r) => r.stage === 'disambig' && r.outcome === 'miss');
    if (disambigMissed) {
      const canonical = exactDisambig.detail?.['canonical'] as string | undefined;
      return { kind: 'rejected-disambig', canonical };
    }
  }

  // Opensearch iterate had hits but none cleared the gate. Surface 1–2
  // close candidates so the player understands "we saw similar names but
  // they didn't match." Skip if the only rejection mode was 'initials' —
  // that's just opensearch returning unrelated suggestions, not "close
  // matches we rejected".
  const iterateRecords = recordsBy(trace, 'opensearch', 'miss').filter(
    (r) => r.label.startsWith('iterate:'),
  );
  if (iterateRecords.length > 0) {
    // Was there any fictional hit in iterate? Bubble it up — it's a more
    // helpful explanation than "different surname".
    for (const r of iterateRecords) {
      if (r.detail?.['personKind'] === 'fictional') {
        const canonical = r.detail['canonicalTitle'] as string | undefined;
        if (canonical) return { kind: 'rejected-fictional', canonical, personKind: 'fictional' };
      }
    }
    // Pick the 1–2 most-promising candidates: those that passed initials
    // and ratio (got far enough to be name-checked) before being rejected.
    const promising = iterateRecords
      .filter((r) => {
        const reason = r.detail?.['rejectedBy'];
        return reason === 'surname' || reason === 'firstName' || reason === 'person';
      })
      .map((r) => r.detail?.['canonicalTitle'] as string | undefined)
      .filter((s): s is string => Boolean(s));
    if (promising.length > 0) {
      return { kind: 'rejected-different-person', closestCandidates: promising.slice(0, 2) };
    }
  }

  // Opensearch returned zero hits AND the exact endpoint 404'd — i.e.
  // there's no plausible Wikipedia article for this name at all.
  const opensearchInfo = trace.find(
    (r) => r.stage === 'opensearch' && r.outcome === 'info' && r.label.includes('Opensearch'),
  );
  const exact404 = exactMisses.some((r) => /404|no article/i.test(r.note));
  const hits = opensearchInfo?.detail?.['hits'];
  const hitCount = Array.isArray(hits) ? hits.length : -1;
  if (exact404 && hitCount === 0) {
    return { kind: 'rejected-no-page' };
  }

  // Fallback — opensearch had results but the iterate stage didn't emit
  // any per-hit miss (rare), or some other path we don't classify.
  return { kind: 'rejected-unknown' };
}
