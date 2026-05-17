import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';

interface AdminState {
  isAdmin: boolean;
  loading: boolean;
}

/** Reads profiles.is_admin for the currently-authed user. Refreshes
 *  whenever the auth user changes. Anonymous users are never admin. */
export function useAdmin(): AdminState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<AdminState>({ isAdmin: false, loading: true });

  useEffect(() => {
    if (authLoading) {
      setState({ isAdmin: false, loading: true });
      return;
    }
    if (!user) {
      setState({ isAdmin: false, loading: false });
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();
        if (!alive) return;
        setState({ isAdmin: Boolean((data as { is_admin?: boolean } | null)?.is_admin), loading: false });
      } catch {
        if (alive) setState({ isAdmin: false, loading: false });
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, authLoading]);

  return state;
}
