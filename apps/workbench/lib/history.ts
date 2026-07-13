// SPDX-License-Identifier: Apache-2.0

'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Generic undo/redo history for canvas (or any) state. Keeps a stack of
 * snapshots and exposes whether undo/redo are available. External changes that
 * should NOT be recorded (e.g. live updates from the server) use `setSilent`.
 *
 * IMPORTANT: `setSilent` and `commit` are safe to call in the same React batch
 * because `commit` reads from a ref rather than the stale state closure.
 */
export function useHistory<T>(initial: T, cap = 100) {
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [present, setPresent] = useState<T>(initial);
  const presentRef = useRef<T>(initial);
  const [can, setCan] = useState({ undo: false, redo: false });

  const recompute = (p: T[], f: T[]) => setCan({ undo: p.length > 0, redo: f.length > 0 });

  const commit = useCallback((next: T) => {
    const cur = presentRef.current;
    past.current.push(cur);
    if (past.current.length > cap) past.current.shift();
    future.current = [];
    presentRef.current = next;
    setPresent(next);
    recompute(past.current, future.current);
  }, [cap]);

  /** Replace present without touching the history stack (live/external updates). */
  const setSilent = useCallback((next: T) => {
    presentRef.current = next;
    setPresent(next);
  }, []);

  const undo = useCallback((): T | null => {
    const prev = past.current.pop();
    if (prev === undefined) return null;
    const cur = presentRef.current;
    future.current.push(cur);
    presentRef.current = prev;
    setPresent(prev);
    recompute(past.current, future.current);
    return prev;
  }, []);

  const redo = useCallback((): T | null => {
    const next = future.current.pop();
    if (next === undefined) return null;
    const cur = presentRef.current;
    past.current.push(cur);
    presentRef.current = next;
    setPresent(next);
    recompute(past.current, future.current);
    return next;
  }, []);

  return { present, commit, setSilent, undo, redo, can };
}
