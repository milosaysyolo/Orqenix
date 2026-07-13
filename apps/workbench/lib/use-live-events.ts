// SPDX-License-Identifier: Apache-2.0

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface LiveEvent {
  id: string;
  kind: string;
  ts: string;
  correlationId?: string;
  parentId?: string;
  actor?: string;
  payload: Record<string, unknown>;
}

export interface UseLiveEventsResult {
  connected: boolean;
  latest: LiveEvent | null;
  events: LiveEvent[];
  clear: () => void;
}

export function useLiveEvents(filterKinds?: string[], cap = 200): UseLiveEventsResult {
  const [connected, setConnected] = useState(false);
  const [latest, setLatest] = useState<LiveEvent | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mountedRef = useRef(true);

  const clear = useCallback(() => setEvents([]), []);

  useEffect(() => {
    mountedRef.current = true;

    const connect = () => {
      if (!mountedRef.current) return;
      const es = new EventSource('/api/stream');
      esRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) { es.close(); return; }
        setConnected(true);
        retryRef.current = 0;
      };

      es.addEventListener('orqenix', (ev) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse((ev as MessageEvent).data) as LiveEvent;
          if (filterKinds && !filterKinds.includes(data.kind)) return;
          setLatest(data);
          setEvents((prev) => {
            const next = [...prev, data];
            return next.length > cap ? next.slice(next.length - cap) : next;
          });
        } catch {
          /* ignore malformed frame */
        }
      });

      es.onerror = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        es.close();
        // Exponential backoff with random jitter to prevent thundering herd.
        const base = Math.min(10000, 500 * 2 ** retryRef.current++);
        const delay = base * (0.5 + Math.random() * 0.5);
        timerRef.current = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      esRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filterKinds), cap]);

  return { connected, latest, events, clear };
}
