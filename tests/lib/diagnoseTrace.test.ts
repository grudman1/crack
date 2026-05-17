import { describe, it, expect } from 'vitest';
import { diagnoseTrace } from '@/lib/diagnoseTrace';
import type { TraceRecord } from '@/services/wikiValidationService';

// Fixtures roughly mirror what validateName() emits in production. We
// keep them minimal — only the fields each rule cares about — to keep
// each test focused on the heuristic it exercises.

describe('diagnoseTrace', () => {
  it('rule 1 — stripped-candidate present but neither matched (title-strip miss)', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: 'PH match PH' },
      {
        stage: 'exact',
        label: 'Wikipedia exact-title',
        outcome: 'miss',
        note: '"Some Title, Earl of Foo" — initials SE/SF ✗, ratio ✓, person skipped',
      },
      { stage: 'final', label: 'Reject', outcome: 'info', note: "couldn't verify" },
    ];
    const d = diagnoseTrace(trace);
    expect(d.suggestedAction).toBe('fix_validator');
    expect(d.suspectedStage).toBe('exact');
    expect(d.hint.toLowerCase()).toContain('stripcanonicalnoblesuffix');
  });

  it('rule 2 — exact had a Q-ID but person-check rejected', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: 'JD match JD' },
      {
        stage: 'exact',
        label: 'Wikipedia exact-title',
        outcome: 'miss',
        note: '"Some Person" — initials JD ✓, ratio ✓, person ✗',
        detail: { canonical: 'Some Person', wikibase_item: 'Q12345' },
      },
    ];
    const d = diagnoseTrace(trace);
    expect(d.suggestedAction).toBe('fix_validator');
    expect(d.suspectedStage).toBe('exact');
    expect(d.hint.toLowerCase()).toContain('isperson');
  });

  it('rule 3 — initials match but ratio fails (stub typed)', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: 'TR match TR' },
      {
        stage: 'exact',
        label: 'Wikipedia exact-title',
        outcome: 'miss',
        note: '"Teddy Roosevelt" — initials TR ✓, ratio ✗, person skipped',
      },
    ];
    const d = diagnoseTrace(trace);
    expect(d.suggestedAction).toBe('fix_validator');
    expect(d.hint.toLowerCase()).toContain('ratio');
  });

  it('rule 4 — opensearch returned zero hits (Wikipedia ambiguity)', () => {
    const trace: TraceRecord[] = [
      {
        stage: 'gate',
        label: 'Initials',
        outcome: 'hit',
        note: 'typed initials XY match expected XY',
      },
      { stage: 'exact', label: 'Wikipedia exact-title', outcome: 'miss', note: '404' },
      {
        stage: 'opensearch',
        label: 'Opensearch (typo-tolerant)',
        outcome: 'info',
        note: '0 hits',
        detail: { hits: [] },
      },
    ];
    const d = diagnoseTrace(trace, 'XY');
    expect(d.suggestedAction).toBe('add_to_dataset');
    expect(d.likelyCause).toBe('wikipedia_ambiguity');
    expect(d.hint.toLowerCase()).toContain('verify before adding');
  });

  it('rule 4 — opensearch returned hits but none have matching initials', () => {
    // Player typed "Xyz Abc" (pair XA). Wikipedia surfaced 3 results but
    // none of them are people whose initials are X·A — they're all
    // unrelated articles. The validator did nothing wrong.
    const trace: TraceRecord[] = [
      {
        stage: 'gate',
        label: 'Initials',
        outcome: 'hit',
        note: 'typed initials XA match expected XA',
      },
      { stage: 'exact', label: 'Wikipedia exact-title', outcome: 'miss', note: '404' },
      {
        stage: 'opensearch',
        label: 'Opensearch (typo-tolerant)',
        outcome: 'info',
        note: '3 hits',
        detail: { hits: ['Xenon', 'Xylophone Music', 'Xerox Corporation'] },
      },
    ];
    const d = diagnoseTrace(trace, 'XA');
    expect(d.suggestedAction).toBe('add_to_dataset');
    expect(d.likelyCause).toBe('wikipedia_ambiguity');
    expect(d.suspectedStage).toBe('opensearch');
    expect(d.hint.toLowerCase()).toContain('verify before adding');
  });

  it('rule 4 — "Charlotte Tate" CT, opensearch returns Charlotte Rae / Hatherley (none CT)', () => {
    // Real-shape false-rejection example: the typed name resolves to
    // CT (Charlotte + Tate). Opensearch surfaces other Charlottes
    // (Charlotte Rae = CR, Charlotte Hatherley = CH), neither of
    // which has matching initials. Pattern 4 — search miss, not a
    // validator bug. The right move is to verify the person exists.
    const trace: TraceRecord[] = [
      {
        stage: 'gate',
        label: 'Initials',
        outcome: 'hit',
        note: 'typed initials CT match expected CT',
      },
      { stage: 'exact', label: 'Wikipedia exact-title', outcome: 'miss', note: '404' },
      {
        stage: 'opensearch',
        label: 'Opensearch (typo-tolerant)',
        outcome: 'info',
        note: '2 hits',
        detail: { hits: ['Charlotte Rae', 'Charlotte Hatherley'] },
      },
    ];
    const d = diagnoseTrace(trace, 'CT');
    expect(d.suggestedAction).toBe('add_to_dataset');
    expect(d.likelyCause).toBe('wikipedia_ambiguity');
    expect(d.suspectedStage).toBe('opensearch');
  });

  it('rule 5 — at least one opensearch hit has matching initials, all rejected downstream', () => {
    // Player typed something resolving to AB. Opensearch returned a
    // mix; "Alex Baldwin" has initials AB and is the real candidate,
    // but the chain rejected it (e.g. person-check missed). That's a
    // validator bug, not a Wikipedia gap.
    const trace: TraceRecord[] = [
      {
        stage: 'gate',
        label: 'Initials',
        outcome: 'hit',
        note: 'typed initials AB match expected AB',
      },
      { stage: 'exact', label: 'Wikipedia exact-title', outcome: 'miss', note: '404' },
      {
        stage: 'opensearch',
        label: 'Opensearch (typo-tolerant)',
        outcome: 'info',
        note: '3 hits',
        detail: { hits: ['Alex Baldwin', 'Xenon', 'Yttrium'] },
      },
      {
        stage: 'opensearch',
        label: 'Opensearch iterate',
        outcome: 'miss',
        note: '"Alex Baldwin" — not a person',
      },
    ];
    const d = diagnoseTrace(trace, 'AB');
    expect(d.suggestedAction).toBe('fix_validator');
    expect(d.likelyCause).toBe('validator_bug');
    expect(d.suspectedStage).toBe('opensearch');
    expect(d.hint.toLowerCase()).toContain('matching initials');
    // Spec calls for the hint to enumerate the downstream checks the
    // admin should inspect.
    expect(d.hint).toMatch(/length ratio.*person.*surname/i);
  });

  it('parses expected pair from gate trace when arg omitted', () => {
    // Same fixture as the rule-4 matching-initials test, but the
    // expectedPair arg is omitted — the helper should recover XA from
    // the gate note and still pick the "no matching initials" path.
    const trace: TraceRecord[] = [
      {
        stage: 'gate',
        label: 'Initials',
        outcome: 'hit',
        note: 'typed initials XA match expected XA',
      },
      {
        stage: 'opensearch',
        label: 'Opensearch (typo-tolerant)',
        outcome: 'info',
        note: '3 hits',
        detail: { hits: ['Xenon', 'Xylophone', 'Xerox'] },
      },
    ];
    const d = diagnoseTrace(trace);
    expect(d.suggestedAction).toBe('add_to_dataset');
    expect(d.likelyCause).toBe('wikipedia_ambiguity');
  });

  it('rule 6 — disambig iterated but no person matched', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: 'CE match CE' },
      { stage: 'exact', label: 'Wikipedia exact-title', outcome: 'miss', note: '"Chris Evans" is a disambiguation page' },
      {
        stage: 'disambig',
        label: 'Disambig wikitext',
        outcome: 'miss',
        note: 'iterated 12 links, none were a person',
      },
    ];
    const d = diagnoseTrace(trace);
    expect(d.suggestedAction).toBe('fix_validator');
    expect(d.suspectedStage).toBe('disambig');
  });

  it('rule 7 — gate rejected on initials mismatch (player error)', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'miss', note: 'expected JD, got JF' },
      { stage: 'final', label: 'Reject', outcome: 'info', note: 'expected JD, got JF' },
    ];
    const d = diagnoseTrace(trace);
    expect(d.suspectedStage).toBe('gate');
    expect(d.likelyCause).toBe('unknown');
    expect(d.suggestedAction).toBe('add_to_dataset');
  });

  it('rule 8 — fallback when nothing else matches', () => {
    const trace: TraceRecord[] = [
      { stage: 'final', label: 'Reject', outcome: 'info', note: 'empty answer' },
    ];
    const d = diagnoseTrace(trace);
    expect(d.likelyCause).toBe('unknown');
    expect(d.suggestedAction).toBe('fix_validator');
  });

  it('rule 9 — accepted via exact on weak signal (no wikibase_item)', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: 'AB match AB' },
      { stage: 'local', label: 'Local fast-path', outcome: 'miss', note: 'no match' },
      {
        stage: 'exact',
        label: 'Wikipedia exact-title',
        outcome: 'hit',
        note: '"Some Place" — initials AB ✓, length ratio ✓, person ✓',
        detail: { canonical: 'Some Place' }, // intentionally no wikibase_item
      },
      { stage: 'final', label: 'Accept', outcome: 'info', note: 'canonical: Some Place' },
    ];
    const d = diagnoseTrace(trace);
    expect(d.suggestedAction).toBe('fix_validator');
    expect(d.suspectedStage).toBe('exact');
    expect(d.hint.toLowerCase()).toContain('weak signal');
  });

  it('rule 9 does NOT fire when wikibase_item is present', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: 'AB match AB' },
      {
        stage: 'exact',
        label: 'Wikipedia exact-title',
        outcome: 'hit',
        note: '"Real Person" — initials AB ✓, length ratio ✓, person ✓',
        detail: { canonical: 'Real Person', wikibase_item: 'Q12345' },
      },
      { stage: 'final', label: 'Accept', outcome: 'info', note: 'canonical: Real Person' },
    ];
    const d = diagnoseTrace(trace);
    // Falls through to fallback since no acceptance rule matches with a Q-ID present.
    expect(d.hint.toLowerCase()).not.toContain('weak signal');
  });

  it('rule 10 — accepted via opensearch iterate', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: 'AB match AB' },
      { stage: 'local', label: 'Local fast-path', outcome: 'miss', note: 'no match' },
      { stage: 'exact', label: 'Wikipedia exact-title', outcome: 'miss', note: '404' },
      {
        stage: 'opensearch',
        label: 'Opensearch (typo-tolerant)',
        outcome: 'info',
        note: '3 hits',
        detail: { hits: ['Foo', 'Bar', 'Baz'] },
      },
      {
        stage: 'opensearch',
        label: 'Opensearch iterate',
        outcome: 'hit',
        note: '"Bar" — initials ✓, ratio ✓, person ✓',
        detail: { canonical: 'Bar' },
      },
      { stage: 'final', label: 'Accept', outcome: 'info', note: 'canonical: Bar' },
    ];
    const d = diagnoseTrace(trace);
    expect(d.suggestedAction).toBe('fix_validator');
    expect(d.suspectedStage).toBe('opensearch');
    expect(d.hint.toLowerCase()).toContain('prominence');
  });

  it('rule 11 — accepted via local fast-path (bad FAMOUS_PEOPLE entry)', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: 'AB match AB' },
      {
        stage: 'local',
        label: 'Local fast-path',
        outcome: 'hit',
        note: 'matched FAMOUS_PEOPLE[AB] entry "Alec Baldwin"',
        detail: { canonical: 'Alec Baldwin', pool: 5 },
      },
      { stage: 'final', label: 'Accept', outcome: 'info', note: 'canonical: Alec Baldwin' },
    ];
    const d = diagnoseTrace(trace);
    expect(d.suggestedAction).toBe('remove_from_dataset');
    expect(d.suspectedStage).toBe('local');
  });
});
