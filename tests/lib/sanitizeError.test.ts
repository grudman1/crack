import { describe, it, expect } from 'vitest';
import { sanitizeError } from '@/lib/sanitizeError';

describe('sanitizeError', () => {
  // --- The regression that motivates this whole file ---
  // Supabase Postgrest errors come back as plain objects, not Error
  // instances. Previously they fell through to the generic
  // "Something went wrong." mask, hiding the real cause.
  it('returns the real message for a Postgrest-shaped DB error (no masking)', () => {
    const err = {
      message: 'duplicate key value violates unique constraint "submissions_pkey"',
      code: '23505',
      details: null,
      hint: null,
    };
    expect(sanitizeError(err)).toBe(
      'duplicate key value violates unique constraint "submissions_pkey"',
    );
  });

  it('maps an RLS violation object to friendly copy', () => {
    const err = {
      message: 'new row violates row-level security policy for table "submissions"',
    };
    expect(sanitizeError(err)).toBe("You don't have permission to do that.");
  });

  it('maps a network-ish message to network copy', () => {
    expect(sanitizeError(new Error('Failed to fetch'))).toBe(
      'Network issue. Check your connection.',
    );
    expect(sanitizeError({ message: 'Load failed' })).toBe(
      'Network issue. Check your connection.',
    );
  });

  it('returns the generic fallback for null / undefined', () => {
    expect(sanitizeError(null)).toBe('Something went wrong.');
    expect(sanitizeError(undefined)).toBe('Something went wrong.');
  });

  it('passes a plain string through unchanged (no category match)', () => {
    expect(sanitizeError('something specific happened')).toBe('something specific happened');
  });

  // --- L5 cases from the previous audit batch — must keep mapping ---
  it('keeps the anonymous-sign-ins-disabled friendly copy', () => {
    const err = new Error('Anonymous sign-ins are disabled');
    expect(sanitizeError(err)).toBe(
      'Anonymous play is disabled on this server. Sign up via the menu to continue.',
    );
  });

  it('keeps the validation-review rate-limit friendly copy', () => {
    const err = { message: 'rate limit exceeded — try again in a minute' };
    expect(sanitizeError(err)).toBe('Too many requests. Try again in a minute.');
  });

  // --- extractErrorMessage shape coverage ---
  it('extracts from { error_description } (Supabase auth shape)', () => {
    const err = { error_description: 'invalid grant: bad refresh token' };
    expect(sanitizeError(err)).toBe('invalid grant: bad refresh token');
  });

  it('extracts from a string-valued { error } property', () => {
    expect(sanitizeError({ error: 'server exploded' })).toBe('server exploded');
  });

  it('extracts from a nested { error: { message } }', () => {
    expect(sanitizeError({ error: { message: 'nested cause' } })).toBe('nested cause');
  });

  it('falls back to .details when .message is empty', () => {
    expect(sanitizeError({ message: '', details: 'column "x" does not exist' })).toBe(
      'column "x" does not exist',
    );
  });

  it('maps a JWT-shaped message to the auth friendly copy', () => {
    expect(sanitizeError({ message: 'invalid JWT' })).toBe('Please sign in and try again.');
  });
});
