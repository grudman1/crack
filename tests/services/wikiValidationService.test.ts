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

  it('lowercase typed input no longer poisons the iterate stage via summaryCache', async () => {
    // Regression for the case-collision cache bug. Wikipedia REST is
    // case-sensitive on URL paths, so /page/summary/robin%20thicke is
    // 404 while /page/summary/Robin%20Thicke is 200. The summary
    // cache used to key by lowercased title, which meant the exact
    // stage's 404 (cached as null under "robin thicke") would
    // short-circuit a perfectly valid opensearch-iterate fetch for
    // "Robin Thicke" — both lookups hashed to the same key. After
    // the fix, the iterate stage hits the live API and resolves.
    clearValidationCache();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      // Lowercase exact lookup → 404.
      if (url.includes('/page/summary/robin%20thicke')) {
        return new Response(null, { status: 404 });
      }
      // Capitalized canonical → 200 with a real summary.
      if (url.includes('/page/summary/Robin%20Thicke')) {
        return new Response(
          JSON.stringify({
            title: 'Robin Thicke',
            type: 'standard',
            extract:
              'Robin Charles Thicke (born March 10, 1977) is an American singer and songwriter.',
            wikibase_item: 'Q467423',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      // Opensearch surfaces the canonical title as the top hit.
      if (url.includes('action=opensearch')) {
        return new Response(
          JSON.stringify([
            'robin thicke',
            ['Robin Thicke', 'Robin Thicke discography'],
            ['', ''],
            ['', ''],
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      // Wikidata says Q467423 is a human.
      if (url.includes('EntityData/Q467423')) {
        return new Response(
          JSON.stringify({
            entities: {
              Q467423: {
                claims: {
                  P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }],
                },
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(null, { status: 404 });
    });

    const result = await validateName('robin thicke', {
      expectedInitials: 'RT',
      bypassCache: true,
    });
    expect(result.status).toBe('valid');
    expect(result.canonicalName).toBe('Robin Thicke');
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
