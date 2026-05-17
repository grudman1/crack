import { describe, it, expect } from 'vitest';
import { explainTrace, type ExplainContext } from '@/lib/explainTrace';
import type { TraceRecord } from '@/services/wikiValidationService';

// Fixtures mirror the trace shape validateName() actually emits — see
// src/services/wikiValidationService.ts for the source of truth. Each
// fixture is the minimum trace needed to exercise one explainTrace
// branch; if the validator's trace shape drifts these tests will catch
// the mismatch.

const VALID: ExplainContext = { status: 'valid', typedName: 'billy idol', expectedPair: 'BI' };
const INVALID = (typed: string, pair?: string): ExplainContext => ({
  status: 'invalid',
  typedName: typed,
  expectedPair: pair,
});

describe('explainTrace', () => {
  it('accepted via local fast-path', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: 'BI = BI' },
      {
        stage: 'local',
        label: 'Local fast-path',
        outcome: 'hit',
        note: 'matched FAMOUS_PEOPLE[BI] entry "Billy Idol"',
        detail: { canonical: 'Billy Idol', pool: 4 },
      },
      { stage: 'final', label: 'Accept', outcome: 'info', note: 'canonical: Billy Idol' },
    ];
    const r = explainTrace(trace, VALID);
    expect(r.kind).toBe('accepted-local');
    expect(r.canonical).toBe('Billy Idol');
  });

  it('accepted via Wikipedia exact-title', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: '' },
      { stage: 'local', label: 'Local fast-path', outcome: 'miss', note: 'no match' },
      {
        stage: 'exact',
        label: 'Wikipedia exact-title',
        outcome: 'hit',
        note: '"Dan Newhouse" — initials DN ✓, length ratio ✓, person ✓',
        detail: { canonical: 'Dan Newhouse', personKind: 'human' },
      },
      { stage: 'final', label: 'Accept', outcome: 'info', note: 'canonical: Dan Newhouse' },
    ];
    const r = explainTrace(trace, { ...VALID, typedName: 'Dan Newhouse', expectedPair: 'DN' });
    expect(r.kind).toBe('accepted-exact');
    expect(r.canonical).toBe('Dan Newhouse');
  });

  it('accepted via 1-token-abbreviation redirect (e.g. "JFK")', () => {
    const trace: TraceRecord[] = [
      {
        stage: '1tok-redirect',
        label: '1-token redirect',
        outcome: 'hit',
        note: 'redirected to "John F. Kennedy" (initials JK) — person',
        detail: { canonicalTitle: 'John F. Kennedy', personKind: 'human' },
      },
      { stage: 'final', label: 'Accept', outcome: 'info', note: 'canonical: John F. Kennedy' },
    ];
    const r = explainTrace(trace, { ...VALID, typedName: 'JFK', expectedPair: 'JK' });
    expect(r.kind).toBe('accepted-exact');
    expect(r.canonical).toBe('John F. Kennedy');
  });

  it('accepted via fuzzy opensearch iterate (typo)', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: '' },
      { stage: 'local', label: 'Local fast-path', outcome: 'miss', note: '' },
      { stage: 'exact', label: 'Wikipedia exact-title', outcome: 'miss', note: '404' },
      { stage: 'opensearch', label: 'Opensearch (typo-tolerant)', outcome: 'info', note: '2 hits', detail: { hits: ['Harry Reasoner', 'Harry Reasor'] } },
      {
        stage: 'opensearch',
        label: 'iterate: Harry Reasoner',
        outcome: 'hit',
        note: '"Harry Reasoner" — all checks pass',
        detail: { canonicalTitle: 'Harry Reasoner' },
      },
      { stage: 'final', label: 'Accept', outcome: 'info', note: 'canonical: Harry Reasoner' },
    ];
    const r = explainTrace(trace, { ...VALID, typedName: 'Harry Reasner', expectedPair: 'HR' });
    expect(r.kind).toBe('accepted-fuzzy');
    expect(r.canonical).toBe('Harry Reasoner');
  });

  it('rejected — initials gate miss', () => {
    const trace: TraceRecord[] = [
      {
        stage: 'gate',
        label: 'Initials',
        outcome: 'miss',
        note: 'expected DT, got DH',
      },
      { stage: 'final', label: 'Reject', outcome: 'info', note: 'expected DT, got DH' },
    ];
    const r = explainTrace(trace, INVALID('dylant homas', 'DT'));
    expect(r.kind).toBe('rejected-initials-mismatch');
    expect(r.typedInitials).toBe('DH');
    expect(r.expectedPair).toBe('DT');
  });

  it('rejected — no Wikipedia page at all (404 + zero opensearch hits)', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: '' },
      { stage: 'local', label: 'Local fast-path', outcome: 'miss', note: '' },
      { stage: 'exact', label: 'Wikipedia exact-title', outcome: 'miss', note: '404 — no article at that title' },
      {
        stage: 'opensearch',
        label: 'Opensearch (typo-tolerant)',
        outcome: 'info',
        note: '0 hits',
        detail: { hits: [] },
      },
      { stage: 'final', label: 'Reject', outcome: 'info', note: "couldn't verify" },
    ];
    const r = explainTrace(trace, INVALID('catherine frank', 'CF'));
    expect(r.kind).toBe('rejected-no-page');
  });

  it('rejected — fictional character (exact match flagged via Wikidata)', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: '' },
      { stage: 'local', label: 'Local fast-path', outcome: 'miss', note: '' },
      {
        stage: 'exact',
        label: 'Wikipedia exact-title',
        outcome: 'miss',
        note: '"Ebenezer Scrooge" — initials ES ✓, ratio ✓, person ✗',
        detail: { canonical: 'Ebenezer Scrooge', personKind: 'fictional' },
      },
      { stage: 'final', label: 'Reject', outcome: 'info', note: "couldn't verify" },
    ];
    const r = explainTrace(trace, INVALID('ebenezer scrooge', 'ES'));
    expect(r.kind).toBe('rejected-fictional');
    expect(r.canonical).toBe('Ebenezer Scrooge');
  });

  it('rejected — found a real entity but not a person (place / org)', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: '' },
      { stage: 'local', label: 'Local fast-path', outcome: 'miss', note: '' },
      {
        stage: 'exact',
        label: 'Wikipedia exact-title',
        outcome: 'miss',
        note: '"Boston Massachusetts" — initials BM ✓, ratio ✓, person ✗',
        detail: { canonical: 'Boston Massachusetts', personKind: 'other' },
      },
      { stage: 'final', label: 'Reject', outcome: 'info', note: "couldn't verify" },
    ];
    const r = explainTrace(trace, INVALID('Boston Massachusetts', 'BM'));
    expect(r.kind).toBe('rejected-not-person');
    expect(r.canonical).toBe('Boston Massachusetts');
  });

  it('rejected — closest matches were different people (surname mismatch)', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: '' },
      { stage: 'local', label: 'Local fast-path', outcome: 'miss', note: '' },
      { stage: 'exact', label: 'Wikipedia exact-title', outcome: 'miss', note: '404 — no article at that title' },
      {
        stage: 'opensearch',
        label: 'Opensearch (typo-tolerant)',
        outcome: 'info',
        note: '3 hits',
        detail: { hits: ['Hannah Rudd', 'Hannah Reddy', 'Hannah Roe'] },
      },
      {
        stage: 'opensearch',
        label: 'iterate: Hannah Rudd',
        outcome: 'miss',
        note: '"Hannah Rudd" — surname ≁',
        detail: { canonicalTitle: 'Hannah Rudd', rejectedBy: 'surname' },
      },
      {
        stage: 'opensearch',
        label: 'iterate: Hannah Reddy',
        outcome: 'miss',
        note: '"Hannah Reddy" — surname ≁',
        detail: { canonicalTitle: 'Hannah Reddy', rejectedBy: 'surname' },
      },
      { stage: 'final', label: 'Reject', outcome: 'info', note: "couldn't verify" },
    ];
    const r = explainTrace(trace, INVALID('hannah rudman', 'HR'));
    expect(r.kind).toBe('rejected-different-person');
    expect(r.closestCandidates).toEqual(['Hannah Rudd', 'Hannah Reddy']);
  });

  it('rejected — disambiguation page that iterate couldn\'t resolve', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: '' },
      { stage: 'local', label: 'Local fast-path', outcome: 'miss', note: '' },
      {
        stage: 'exact',
        label: 'Wikipedia exact-title',
        outcome: 'miss',
        note: '"John Smith" is a disambiguation page — flagged for stage (d)',
        detail: { canonical: 'John Smith' },
      },
      {
        stage: 'disambig',
        label: 'Disambig wikitext',
        outcome: 'miss',
        note: 'iterated 42 links, evaluated 6, none were a person matching',
      },
      { stage: 'final', label: 'Reject', outcome: 'info', note: "couldn't verify" },
    ];
    const r = explainTrace(trace, INVALID('John Smith', 'JS'));
    expect(r.kind).toBe('rejected-disambig');
    expect(r.canonical).toBe('John Smith');
  });

  it('iterate fictional hit is preferred over surname-rejection candidates', () => {
    // If opensearch found a fictional character with matching initials,
    // that's a more useful explanation than "we saw other people with
    // different surnames."
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: '' },
      { stage: 'local', label: 'Local fast-path', outcome: 'miss', note: '' },
      { stage: 'exact', label: 'Wikipedia exact-title', outcome: 'miss', note: '404 — no article at that title' },
      { stage: 'opensearch', label: 'Opensearch (typo-tolerant)', outcome: 'info', note: '2 hits', detail: { hits: ['Tony Stark', 'Tony Stork'] } },
      {
        stage: 'opensearch',
        label: 'iterate: Tony Stark',
        outcome: 'miss',
        note: '"Tony Stark" — not a person (fictional)',
        detail: { canonicalTitle: 'Tony Stark', rejectedBy: 'person', personKind: 'fictional' },
      },
      {
        stage: 'opensearch',
        label: 'iterate: Tony Stork',
        outcome: 'miss',
        note: '"Tony Stork" — surname mismatch',
        detail: { canonicalTitle: 'Tony Stork', rejectedBy: 'surname' },
      },
      { stage: 'final', label: 'Reject', outcome: 'info', note: "couldn't verify" },
    ];
    const r = explainTrace(trace, INVALID('Tony Stark', 'TS'));
    expect(r.kind).toBe('rejected-fictional');
    expect(r.canonical).toBe('Tony Stark');
  });

  it('falls through to rejected-unknown when nothing matches', () => {
    const trace: TraceRecord[] = [
      { stage: 'gate', label: 'Initials', outcome: 'hit', note: '' },
      // No further stages — shouldn't happen in production but the
      // explainer should degrade gracefully.
      { stage: 'final', label: 'Reject', outcome: 'info', note: "couldn't verify" },
    ];
    const r = explainTrace(trace, INVALID('Mystery Name', 'MN'));
    expect(r.kind).toBe('rejected-unknown');
  });

  it('valid status with no hit record falls through to unknown (defensive)', () => {
    const trace: TraceRecord[] = [
      { stage: 'final', label: 'Cached', outcome: 'info', note: 'served from in-memory cache: valid' },
    ];
    const r = explainTrace(trace, VALID);
    expect(r.kind).toBe('rejected-unknown');
  });
});
