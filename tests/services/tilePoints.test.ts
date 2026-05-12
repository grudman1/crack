import { describe, it, expect } from 'vitest';
import { TILE_POINTS, pointsFor } from '@/lib/tilePoints';

describe('tile points', () => {
  it('has 26 entries', () => {
    expect(Object.keys(TILE_POINTS)).toHaveLength(26);
  });

  it('Q and Z are worth 10', () => {
    expect(pointsFor('Q')).toBe(10);
    expect(pointsFor('Z')).toBe(10);
  });

  it('A and E are worth 1', () => {
    expect(pointsFor('a')).toBe(1);
    expect(pointsFor('E')).toBe(1);
  });
});
