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
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: 'XY match XY' },
      { stage: 'exact', label: 'Wikipedia exact-title', outcome: 'miss', note: '404' },
      {
        stage: 'opensearch',
        label: 'Opensearch (typo-tolerant)',
        outcome: 'info',
        note: '0 hits',
        detail: { hits: [] },
      },
    ];
    const d = diagnoseTrace(trace);
    expect(d.suggestedAction).toBe('add_to_dataset');
    expect(d.likelyCause).toBe('wikipedia_ambiguity');
  });

  it('rule 5 — opensearch surfaced candidates but all rejected downstream', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: 'AB match AB' },
      { stage: 'exact', label: 'Wikipedia exact-title', outcome: 'miss', note: '404' },
      {
        stage: 'opensearch',
        label: 'Opensearch (typo-tolerant)',
        outcome: 'info',
        note: '3 hits',
        detail: { hits: ['Foo', 'Bar', 'Baz'] },
      },
      { stage: 'opensearch', label: 'Opensearch iterate', outcome: 'miss', note: '"Foo" — not a person' },
      { stage: 'opensearch', label: 'Opensearch iterate', outcome: 'miss', note: '"Bar" — not a person' },
    ];
    const d = diagnoseTrace(trace);
    expect(d.suggestedAction).toBe('fix_validator');
    expect(d.suspectedStage).toBe('opensearch');
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
