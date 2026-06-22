// SPDX-License-Identifier: Apache-2.0

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface LiveEvent {
  kind: string;
  ts: string;
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

  const clear = useCallback(() => setEvents([]), []);

  useEffect(() => {
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      const es = new EventSource('/api/stream');
      esRef.current = es;

      es.onopen = () => {
        setConnected(true);
        retryRef.current = 0;
      };

      es.addEventListener('orqenix', (ev) => {
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
        setConnected(false);
        es.close();
        const delay = Math.min(10000, 500 * 2 ** retryRef.current++);
        setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      stopped = true;
      esRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filterKinds), cap]);

  return { connected, latest, events, clear };
}
