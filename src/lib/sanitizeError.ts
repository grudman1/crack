export function sanitizeError(err: unknown): string {
  const msg = extractErrorMessage(err);
  if (!msg) return 'Something went wrong.';

  // Specific cases first — preserve friendly copy for things we've
  // explicitly identified upstream. Keep these above the broader
  // category regexes so the more-specific match wins.
  if (/anonymous.*disabled|disabled.*anonymous|signups not allowed for anonymous/i.test(msg)) {
    return 'Anonymous play is disabled on this server. Sign up via the menu to continue.';
  }
  if (/rate limit/i.test(msg)) {
    return 'Too many requests. Try again in a minute.';
  }

  // Broad categories.
  if (/violates row-level security|permission denied|not authorized|forbidden/i.test(msg))
    return "You don't have permission to do that.";
  if (/too many requests|\b429\b/i.test(msg))
    return "You're doing that too quickly — give it a moment.";
  if (/network|failed to fetch|load failed|timed? ?out/i.test(msg))
    return 'Network issue. Check your connection.';
  if (/\bjwt\b|not authenticated|invalid token|invalid claim|session.*expired/i.test(msg))
    return 'Please sign in and try again.';

  // Unknown: surface the real message rather than masking it as
  // "Something went wrong." Constraint / DB / parse errors are the
  // ones we actually need to read to diagnose silent autosave-style
  // failures. Sensitive-shaped messages (RLS, auth) are already
  // mapped above, so the generic surface here is the long tail.
  return msg;
}

function extractErrorMessage(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err.trim();
  if (err instanceof Error) return (err.message || '').trim();
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
    if (typeof o.error_description === 'string') return o.error_description.trim();
    if (typeof o.error === 'string') return o.error.trim();
    const nested = o.error as Record<string, unknown> | undefined;
    if (nested && typeof nested.message === 'string') return (nested.message as string).trim();
    if (typeof o.details === 'string' && o.details.trim()) return o.details.trim();
  }
  return '';
}
