import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export function useAuth(): AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInAnonymously: (displayName: string) => Promise<User>;
  signOut: () => Promise<void>;
} {
  const [state, setState] = useState<AuthState>({ user: null, session: null, loading: true });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState({ user: data.session?.user ?? null, session: data.session, loading: false });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setState({ user: session?.user ?? null, session, loading: false });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
  };

  // Anonymous Supabase auth. The display_name lands in
  // raw_user_meta_data, which the handle_new_user trigger reads when it
  // creates the profile row — so we don't need any extra plumbing here
  // beyond the call itself. Requires the Anonymous Sign-Ins toggle to
  // be ON in Supabase → Authentication → Providers.
  const signInAnonymously = async (displayName: string): Promise<User> => {
    const { data, error } = await supabase.auth.signInAnonymously({
      options: { data: { display_name: displayName.trim() || 'Player' } },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Anonymous sign-in returned no user.');
    return data.user;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { ...state, signIn, signUp, signInAnonymously, signOut };
}
