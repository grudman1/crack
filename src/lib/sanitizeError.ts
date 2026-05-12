export function sanitizeError(err: unknown): string {
  if (!err) return 'Something went wrong.';
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    const msg = err.message || 'Unknown error';
    if (/network|fetch/i.test(msg)) return 'Network issue. Check your connection.';
    if (/jwt|auth/i.test(msg)) return 'Sign in to continue.';
    return msg;
  }
  return 'Something went wrong.';
}
