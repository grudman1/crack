import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';

interface AdminState {
  isAdmin: boolean;
  loading: boolean;
}

// Module-level cache keyed by user id. Layout mounts useAdmin on every
// routed page, so without this we'd re-query profiles.is_admin on every
// nav. The value is stable for the lifetime of the session.
const adminCache = new Map<string, boolean>();

/** Drop the cached admin flag — call this on sign-out so a stale flag
 *  can't stick across accounts on a shared browser. */
export function clearAdminCache(): void {
  adminCache.clear();
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
    const cached = adminCache.get(user.id);
    if (cached !== undefined) {
      setState({ isAdmin: cached, loading: false });
      return;
    }
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        // Keep loading=true so a transient read failure doesn't
        // silently demote the user. The next mount will retry. The
        // /admin route guard already short-circuits on loading.
        console.error('[useAdmin] is_admin lookup failed', error);
        setState({ isAdmin: false, loading: true });
        return;
      }
      const isAdmin = Boolean((data as { is_admin?: boolean } | null)?.is_admin);
      adminCache.set(user.id, isAdmin);
      setState({ isAdmin, loading: false });
    })();
    return () => {
      alive = false;
    };
  }, [user, authLoading]);

  return state;
}
