import { describe, it, expect } from 'vitest';
import { buildShareString } from '@/lib/share';

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
