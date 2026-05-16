import { describe, it, expect } from 'vitest';
import { suggestForInitials } from '@/services/soloSuggestions';

describe('suggestForInitials', () => {
  it('returns suggestions for common pairs', async () => {
    const ba = await suggestForInitials('BA', 3);
    expect(ba.length).toBeGreaterThan(0);
    expect(ba[0]).toMatchObject({
      name: expect.any(String),
      wikipediaUrl: expect.stringMatching(/en\.wikipedia\.org/),
    });
  });

  it('respects the limit parameter', async () => {
    const results = await suggestForInitials('AA', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('returns empty array for unknown initials', async () => {
    const results = await suggestForInitials('@@', 3);
    expect(results).toEqual([]);
  });

  it('normalizes case', async () => {
    const upper = await suggestForInitials('BA', 3);
    const lower = await suggestForInitials('ba', 3);
    expect(upper).toEqual(lower);
  });

  // Spot-check: the panel should surface obvious names for common pairs.
  // If this fails, regenerate the dataset.
  it('surfaces recognizable names for sample pairs', async () => {
    const samples = ['EL', 'JE', 'KS', 'LA'];
    for (const pair of samples) {
      const results = await suggestForInitials(pair, 5);
      expect(results.length).toBeGreaterThan(0);
    }
  });
});
