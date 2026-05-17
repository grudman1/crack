import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeNameInitials,
  validateName,
  clearValidationCache,
} from '@/services/wikiValidationService';

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

// -----------------------------------------------------------------------------
// URL-encoding audit
// -----------------------------------------------------------------------------
// The validator interpolates a few user-supplied strings (typed name,
// canonical title, Q-ID) into URLs. Every fetch must encode them so
// browser fetch (which is stricter about URL validity than Node) never
// trips on a literal space or other unsafe character.
//
// The strategy: stub fetch with a 404 so the chain bails out quickly,
// then assert every URL passed to fetch contains the URL-encoded form
// of the suspect token (and never the raw form).

describe('validator URL encoding', () => {
  beforeEach(() => {
    clearValidationCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('every fetch URL encodes the typed name (spaces → %20, no literal spaces)', async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      calls.push(url);
      return new Response('null', { status: 404, headers: { 'content-type': 'application/json' } });
    });

    await validateName('Robin Thicke', { expectedInitials: 'RT' });

    expect(calls.length).toBeGreaterThan(0);
    for (const url of calls) {
      expect(url, `URL must not contain a literal space: ${url}`).not.toContain(' ');
    }

    const summaryCalls = calls.filter((u) => u.includes('/page/summary/'));
    expect(summaryCalls.length).toBeGreaterThan(0);
    expect(summaryCalls.some((u) => u.includes('Robin%20Thicke'))).toBe(true);
  });

  it('opensearch URL encodes the query string', async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      calls.push(url);
      return new Response('null', { status: 404, headers: { 'content-type': 'application/json' } });
    });

    await validateName('Robin Thicke', { expectedInitials: 'RT' });

    const opensearchCalls = calls.filter((u) => u.includes('action=opensearch'));
    expect(opensearchCalls.length).toBeGreaterThan(0);
    for (const u of opensearchCalls) {
      expect(u).toContain('search=Robin%20Thicke');
      expect(u).not.toContain('search=Robin Thicke');
    }
  });
});
