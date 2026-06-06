export function sanitizeError(err: unknown): string {
  if (!err) return 'Something went wrong.';
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    const msg = err.message || 'Unknown error';
    if (/anonymous.*disabled|disabled.*anonymous|signups not allowed for anonymous/i.test(msg)) {
      return 'Anonymous play is disabled on this server. Sign up via the menu to continue.';
    }
    if (/rate limit/i.test(msg)) return 'Too many requests. Try again in a minute.';
    if (/network|fetch/i.test(msg)) return 'Network issue. Check your connection.';
    if (/jwt|auth/i.test(msg)) return 'Sign in to continue.';
    return msg;
  }
  return 'Something went wrong.';
}
