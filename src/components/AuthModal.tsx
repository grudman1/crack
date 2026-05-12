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
      <DialogContent style={{ transform: 'translate(-50%, -50%) rotate(-1deg)' }}>
        <DialogTitle>{mode === 'signin' ? 'Sign In' : 'Sign Up'}</DialogTitle>
        <DialogDescription>Pencil-and-paper feel. Cloud-backed scores.</DialogDescription>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {mode === 'signup' && (
            <label className="block">
              <span className="font-hand text-lg text-ink-soft">display name</span>
              <input
                className="ink-input mt-0.5 border-b border-ink/40 py-1"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Player"
                autoComplete="nickname"
              />
            </label>
          )}
          <label className="block">
            <span className="font-hand text-lg text-ink-soft">email</span>
            <input
              type="email"
              required
              className="ink-input mt-0.5 border-b border-ink/40 py-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="font-hand text-lg text-ink-soft">password</span>
            <input
              type="password"
              required
              minLength={6}
              className="ink-input mt-0.5 border-b border-ink/40 py-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </label>
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              className="font-hand text-base text-ink-soft underline"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin' ? 'need an account?' : 'have an account?'}
            </button>
            <button type="submit" className="btn-paper btn-paper--primary" disabled={busy}>
              {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
