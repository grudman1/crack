// Generic realtime data hooks against Supabase. The wrapper hooks
// (useRoom, useSubmissions, useRoomPlayers, useScores, useVotes,
// useReviews) all followed the same mechanical pattern: useState +
// useEffect that loaded + subscribed to a postgres_changes channel +
// cleaned up. That pattern lives here once.
//
// Two flavors:
//   - useRealtimeRow<T>   single row by some match column (e.g. rooms by code)
//   - useRealtimeTable<T> collection filtered by some match column (or
//                         everything when matchColumn is omitted)
//
// Both:
//   - Are no-ops when "disabled" (matchValue undefined and no loadFn)
//   - Re-load + re-subscribe when matchValue changes
//   - Use a channel name of `${table}:${matchValue ?? 'all'}` unless
//     channelKey is overridden
//   - Subscribe to event='*' on postgres_changes for the matched scope

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';

// ---------- useRealtimeRow -------------------------------------------------

export interface UseRealtimeRowOpts {
  table: string;
  matchColumn: string;
  matchValue: string | undefined;
  /** Filter expression sent to postgres_changes. Defaults to
   *  `${matchColumn}=eq.${matchValue}`. */
  realtimeFilter?: string;
  /** Channel name override; defaults to `${table}:${matchValue}`. */
  channelKey?: string;
}

export interface UseRealtimeRowResult<T> {
  row: T | null;
  loading: boolean;
  error: Error | null;
}

export function useRealtimeRow<T>(opts: UseRealtimeRowOpts): UseRealtimeRowResult<T> {
  const { table, matchColumn, matchValue, realtimeFilter, channelKey } = opts;
  const [row, setRow] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(matchValue !== undefined);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (matchValue === undefined) {
      setRow(null);
      setLoading(false);
      setError(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data, error: e } = await supabase
          .from(table)
          .select('*')
          .eq(matchColumn, matchValue)
          .maybeSingle();
        if (e) throw e;
        if (alive) setRow((data as T | null) ?? null);
      } catch (e) {
        if (alive) setError(e as Error);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    const filter = realtimeFilter ?? `${matchColumn}=eq.${matchValue}`;
    const channel = supabase
      .channel(channelKey ?? `${table}:${matchValue}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        (payload) => {
          if (!alive) return;
          if (payload.eventType === 'DELETE') setRow(null);
          else setRow(payload.new as T);
        },
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [table, matchColumn, matchValue, realtimeFilter, channelKey]);

  return { row, loading, error };
}

// ---------- useRealtimeTable -----------------------------------------------

export interface UseRealtimeTableOpts<T> {
  table: string;
  /** When set, scopes both the load query (.eq) and the realtime
   *  subscription filter. Omit (along with matchValue) to listen to
   *  all rows of the table. */
  matchColumn?: string;
  matchValue?: string | undefined;
  /** Columns to select on the default load query. Defaults to '*'. */
  select?: string;
  /** Channel name override; defaults to `${table}:${matchValue ?? 'all'}`. */
  channelKey?: string;
  /** Custom loader. Used by useRoomPlayers (joins profiles in memory)
   *  and useReviews (delegates to the reviewService). When set, the
   *  hook ignores `select` and runs loadFn instead. The hook is
   *  considered enabled if loadFn is provided, regardless of matchValue. */
  loadFn?: () => Promise<T[]>;
}

export interface UseRealtimeTableResult<T> {
  rows: T[];
  loading: boolean;
  refresh: () => void;
}

export function useRealtimeTable<T>(opts: UseRealtimeTableOpts<T>): UseRealtimeTableResult<T> {
  const { table, matchColumn, matchValue, select = '*', channelKey, loadFn } = opts;
  const [rows, setRows] = useState<T[]>([]);
  const enabled = Boolean(loadFn || matchValue !== undefined);
  const [loading, setLoading] = useState<boolean>(enabled);

  // load is a stable callback the caller can invoke (returned as
  // `refresh`) and that we also call internally on mount + realtime tick.
  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      let data: unknown;
      if (loadFn) {
        data = await loadFn();
      } else {
        let q = supabase.from(table).select(select);
        if (matchColumn && matchValue !== undefined) {
          q = q.eq(matchColumn, matchValue);
        }
        const { data: d, error } = await q;
        if (error) throw error;
        data = d ?? [];
      }
      setRows((Array.isArray(data) ? data : []) as T[]);
    } finally {
      setLoading(false);
    }
  }, [table, matchColumn, matchValue, select, loadFn, enabled]);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      setLoading(false);
      return;
    }
    let alive = true;
    void (async () => {
      await load();
      if (!alive) return;
    })();

    const filter = matchColumn && matchValue !== undefined
      ? `${matchColumn}=eq.${matchValue}`
      : undefined;
    const channel = supabase
      .channel(channelKey ?? `${table}:${matchValue ?? 'all'}`)
      .on(
        'postgres_changes',
        filter
          ? { event: '*', schema: 'public', table, filter }
          : { event: '*', schema: 'public', table },
        () => {
          if (!alive) return;
          void load();
        },
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [enabled, table, matchColumn, matchValue, channelKey, load]);

  return { rows, loading, refresh: () => void load() };
}
