import { describe, it, expect } from 'vitest';
import { computeNameInitials } from '@/services/wikiValidationService';

describe('computeNameInitials', () => {
  it('Alan Turing → AT', () => {
    expect(computeNameInitials('Alan Turing')).toBe('AT');
  });

  it('Henry Cavill → HC', () => {
    expect(computeNameInitials('Henry Cavill')).toBe('HC');
  });

  it('strips suffix Jr', () => {
    expect(computeNameInitials('Martin Luther King Jr.')).toBe('MK');
  });

  it('handles middle names — first + last', () => {
    expect(computeNameInitials('John Fitzgerald Kennedy')).toBe('JK');
  });

  it('strips parens', () => {
    expect(computeNameInitials('Madonna (singer)')).toBe('');
  });

  it('returns empty when only one name', () => {
    expect(computeNameInitials('Cher')).toBe('');
  });

  it('normalizes accents', () => {
    expect(computeNameInitials('Émile Zola')).toBe('EZ');
  });
});
