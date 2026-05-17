import { describe, it, expect, vi, beforeEach } from 'vitest';

// Per-test recording of what the Supabase chained API was called with.
// Each builder returns itself until a "terminal" method (.single() for
// insert, awaited promise for select/update) — that's how the actual
// supabase-js v2 client behaves.

interface Recording {
  authUserId: string | null;
  inserted?: unknown;
  selectFilter?: { col: string; val: unknown };
  selectOrder?: { col: string; ascending: boolean };
  updated?: unknown;
  updatedWhere?: { col: string; val: unknown };
}

const rec: Recording = { authUserId: null };

vi.mock('@/services/supabase', () => {
  // The real Supabase query builder is "thenable" — every chained
  // method returns the same builder, and awaiting the builder kicks
  // off the request. We mimic that with a builder object that has a
  // `.then` so it can be awaited, and where every method returns the
  // builder itself.
  const result = { data: [{ id: 'row-1' }], error: null };
  const builder: Record<string, unknown> = {};
  builder.insert = vi.fn((row: unknown) => {
    rec.inserted = row;
    return builder;
  });
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn((col: string, val: unknown) => {
    if (rec.updated !== undefined) rec.updatedWhere = { col, val };
    else rec.selectFilter = { col, val };
    return builder;
  });
  builder.order = vi.fn((col: string, opts: { ascending: boolean }) => {
    rec.selectOrder = { col, ascending: opts.ascending };
    return builder;
  });
  builder.update = vi.fn((patch: unknown) => {
    rec.updated = patch;
    return builder;
  });
  builder.single = vi.fn(() => Promise.resolve({ data: { id: 'row-1' }, error: null }));
  builder.then = (onFulfilled: (v: typeof result) => unknown) => onFulfilled(result);

  return {
    supabase: {
      from: vi.fn(() => builder),
      auth: {
        getUser: vi.fn(() =>
          Promise.resolve({ data: { user: rec.authUserId ? { id: rec.authUserId } : null } }),
        ),
      },
    },
    SUPABASE_CONFIGURED: true,
  };
});

import {
  submitReview,
  listReviews,
  resolveReview,
} from '@/services/reviewService';

beforeEach(() => {
  rec.authUserId = null;
  rec.inserted = undefined;
  rec.selectFilter = undefined;
  rec.selectOrder = undefined;
  rec.updated = undefined;
  rec.updatedWhere = undefined;
  localStorage.clear();
});

describe('submitReview', () => {
  it('inserts a normalized row and returns the new id', async () => {
    const id = await submitReview({
      name: '  Prince Harry  ',
      expectedPair: 'ph',
      actualResult: 'invalid',
      reason: "couldn't verify",
      trace: [{ stage: 'final', label: 'Reject', outcome: 'info', note: "couldn't verify" }],
      userComment: '  he is the kings son  ',
    });
    expect(id).toBe('row-1');
    expect(rec.inserted).toMatchObject({
      name: 'Prince Harry',
      expected_pair: 'PH',
      actual_result: 'invalid',
      reason: "couldn't verify",
      user_comment: 'he is the kings son',
      player_id: null,
    });
    const inserted = rec.inserted as { client_fingerprint: string };
    expect(inserted.client_fingerprint).toMatch(/^[0-9a-f]{8}-/i);
  });

  it('stamps player_id from the current auth user', async () => {
    rec.authUserId = 'user-42';
    await submitReview({
      name: 'X Y',
      expectedPair: 'XY',
      actualResult: 'invalid',
      trace: [],
    });
    expect((rec.inserted as { player_id: string }).player_id).toBe('user-42');
  });

  it('passes empty comment through as null', async () => {
    await submitReview({
      name: 'X Y',
      expectedPair: 'XY',
      actualResult: 'invalid',
      trace: [],
      userComment: '   ',
    });
    expect((rec.inserted as { user_comment: string | null }).user_comment).toBeNull();
  });
});

describe('listReviews', () => {
  it('filters by status when provided', async () => {
    await listReviews('pending');
    expect(rec.selectFilter).toEqual({ col: 'status', val: 'pending' });
    expect(rec.selectOrder?.col).toBe('created_at');
    expect(rec.selectOrder?.ascending).toBe(false);
  });
});

describe('resolveReview', () => {
  it('writes approved + fix_validator with note', async () => {
    rec.authUserId = 'admin-1';
    await resolveReview('row-1', {
      kind: 'approved',
      resolutionType: 'fix_validator',
      note: 'title-strip bug',
    });
    const patch = rec.updated as Record<string, unknown>;
    expect(patch.status).toBe('approved');
    expect(patch.resolution_type).toBe('fix_validator');
    expect(patch.resolution_note).toBe('title-strip bug');
    expect(patch.reviewed_by).toBe('admin-1');
    expect(typeof patch.reviewed_at).toBe('string');
    expect(rec.updatedWhere).toEqual({ col: 'id', val: 'row-1' });
  });

  it('writes rejected with no resolution_type', async () => {
    await resolveReview('row-1', { kind: 'rejected', note: 'spam' });
    const patch = rec.updated as Record<string, unknown>;
    expect(patch.status).toBe('rejected');
    expect(patch.resolution_type).toBeNull();
    expect(patch.resolution_note).toBe('spam');
  });

  it('writes duplicate with no resolution_type', async () => {
    await resolveReview('row-1', { kind: 'duplicate' });
    const patch = rec.updated as Record<string, unknown>;
    expect(patch.status).toBe('duplicate');
    expect(patch.resolution_type).toBeNull();
    expect(patch.resolution_note).toBeNull();
  });
});
