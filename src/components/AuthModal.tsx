import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { sanitizeError } from '@/lib/sanitizeError';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        toast.success('Welcome back.');
      } else {
        await signUp(email, password, displayName || 'Player');
        toast.success('Check your email to confirm.');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(sanitizeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{mode === 'signin' ? 'Sign in' : 'Save your progress'}</DialogTitle>
        <DialogDescription>
          {mode === 'signin'
            ? 'Welcome back.'
            : 'Sign up to keep your scores across devices. Optional — you can keep playing without an account.'}
        </DialogDescription>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === 'signup' && (
            <label className="block">
              <span className="font-sans text-xs uppercase tracking-wider text-muted">Display name</span>
              <input
                className="input-line mt-1"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Player"
                autoComplete="nickname"
              />
            </label>
          )}
          <label className="block">
            <span className="font-sans text-xs uppercase tracking-wider text-muted">Email</span>
            <input
              type="email"
              required
              className="input-line mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="font-sans text-xs uppercase tracking-wider text-muted">Password</span>
            <input
              type="password"
              required
              minLength={6}
              className="input-line mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </label>
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              className="font-sans text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin' ? 'Need an account?' : 'Have an account?'}
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
