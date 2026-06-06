import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { clearAdminCache } from '@/hooks/useAdmin';

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
  deleteAccount: () => Promise<void>;
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
    // Drop the cached admin flag before tearing down the session so
    // a shared browser can't carry a stale `isAdmin: true` into the
    // next account.
    clearAdminCache();
    await supabase.auth.signOut();
  };

  // Hits the /api/delete-account serverless function with the current
  // access token; the function uses the service-role key to call
  // admin.auth.admin.deleteUser, which cascades through every FK in
  // 0001 (profiles → room_players, submissions, votes, scores, hosted
  // rooms). On success we tear down the local session too.
  const deleteAccount = async (): Promise<void> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('Not signed in');
    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? 'Deletion failed');
    }
    clearAdminCache();
    await supabase.auth.signOut();
  };

  return { ...state, signIn, signUp, signInAnonymously, signOut, deleteAccount };
}
