import { describe, it, expect } from 'vitest';
import { buildCsv, buildTxt } from '@/services/exportService';

describe('exportService', () => {
  const payload = {
    title: 'Test',
    sentence: 'Hello world this is a test',
    letters: 'HELLOWORLDTHISISATESTABCDE',
    totalScore: 20,
    rows: [
      { rowIndex: 0, initials: 'AH', name: 'Alan Halsey', status: 'valid' as const, points: 10 },
      { rowIndex: 1, initials: 'BE', name: 'Bad, "name"', status: 'invalid' as const, reason: 'nope', points: 0 },
    ],
  };

  it('csv escapes commas and quotes', () => {
    const csv = buildCsv(payload);
    expect(csv).toContain('Alan Halsey');
    expect(csv).toContain('"Bad, ""name"""');
  });

  it('txt is human-readable', () => {
    const txt = buildTxt(payload);
    expect(txt).toContain('✓');
    expect(txt).toContain('✗');
    expect(txt).toContain('Total: 20');
  });
});
