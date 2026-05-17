import { describe, it, expect } from 'vitest';
import { buildShareString, buildMultiplayerShareText, type RowOutcome } from '@/lib/share';

describe('buildShareString', () => {
  it('produces a 2-row 13-square grid with correct totals', () => {
    const rowResults = [
      true, true, false, true, true, true, false, true, true, false, true, true, true,
      false, false, true, true, true, true, false, true, true, false, true, true, true,
    ];
    const out = buildShareString({
      roundNumber: 47,
      correctCount: 18,
      rowResults,
      shareUrl: 'crack-black.vercel.app',
    });
    const lines = out.split('\n');
    expect(lines[0]).toBe('Crack #47 — 18/26');
    expect(lines[1]).toBe('');
    // Each row has 13 squares; emoji glyphs vary in JS string length so
    // count actual emoji codepoints, not .length.
    const row1Glyphs = [...lines[2]!];
    const row2Glyphs = [...lines[3]!];
    expect(row1Glyphs).toHaveLength(13);
    expect(row2Glyphs).toHaveLength(13);
    expect(lines[2]).toContain('🟧');
    expect(lines[2]).toContain('⬜');
    expect(lines[3]).toContain('🟧');
    expect(lines[4]).toBe('');
    expect(lines[5]).toBe('crack-black.vercel.app');
  });

  it('uses default URL when none provided', () => {
    const out = buildShareString({
      roundNumber: 1,
      correctCount: 0,
      rowResults: new Array(26).fill(false),
    });
    expect(out).toContain('crack-black.vercel.app');
  });

  it('all-correct grid is all orange squares', () => {
    const out = buildShareString({
      roundNumber: 1,
      correctCount: 26,
      rowResults: new Array(26).fill(true),
    });
    expect(out).not.toContain('⬜');
    expect((out.match(/🟧/g) ?? []).length).toBe(26);
  });
});

describe('buildMultiplayerShareText', () => {
  function mixed(): RowOutcome[] {
    // 10 valid, 8 invalid, 8 blank
    return [
      ...new Array(10).fill('valid' as const),
      ...new Array(8).fill('invalid' as const),
      ...new Array(8).fill('blank' as const),
    ];
  }

  it('produces a header line with ordinal placement', () => {
    const out = buildMultiplayerShareText({
      roundNumber: 12,
      placement: 2,
      totalPlayers: 4,
      points: 75,
      rowOutcomes: mixed(),
    });
    expect(out.split('\n')[0]).toBe('Crack · MP · Round #12 · 2nd of 4');
  });

  it('ordinalizes 1st / 11th / 21st correctly', () => {
    const base = { roundNumber: 1, totalPlayers: 3, points: 0, rowOutcomes: mixed() };
    expect(buildMultiplayerShareText({ ...base, placement: 1 })).toContain('1st');
    expect(buildMultiplayerShareText({ ...base, placement: 11 })).toContain('11th');
    expect(buildMultiplayerShareText({ ...base, placement: 21 })).toContain('21st');
    expect(buildMultiplayerShareText({ ...base, placement: 22 })).toContain('22nd');
    expect(buildMultiplayerShareText({ ...base, placement: 113 })).toContain('113th');
  });

  it('emits three distinct glyphs for the three outcome types', () => {
    const out = buildMultiplayerShareText({
      roundNumber: 1,
      placement: 1,
      totalPlayers: 2,
      points: 100,
      rowOutcomes: mixed(),
    });
    // Count glyphs only in the grid rows (lines 2 + 3) — the header
    // line and " · " separators in it use the same dot character.
    const lines = out.split('\n');
    const grid = `${lines[2] ?? ''}${lines[3] ?? ''}`;
    expect((grid.match(/🟧/g) ?? []).length).toBe(10);
    expect((grid.match(/⬜/g) ?? []).length).toBe(8);
    expect((grid.match(/·/g) ?? []).length).toBe(8);
  });

  it('grid wraps to two 13-row lines', () => {
    const out = buildMultiplayerShareText({
      roundNumber: 1,
      placement: 1,
      totalPlayers: 2,
      points: 0,
      rowOutcomes: mixed(),
    });
    const lines = out.split('\n');
    const rowA = [...(lines[2] ?? '')];
    const rowB = [...(lines[3] ?? '')];
    expect(rowA).toHaveLength(13);
    expect(rowB).toHaveLength(13);
  });

  it('includes points line + default share URL', () => {
    const out = buildMultiplayerShareText({
      roundNumber: 7,
      placement: 1,
      totalPlayers: 2,
      points: 45,
      rowOutcomes: mixed(),
    });
    expect(out).toContain('45 pts');
    expect(out).toContain('crack-black.vercel.app');
  });
});
