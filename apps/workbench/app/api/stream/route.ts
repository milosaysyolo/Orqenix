// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// SSE event stream — when the first client connects, starts the activity
// engine (if not already running) and subscribes to the event bus so every
// event is forwarded as an SSE frame.
// ============================================================================

export const dynamic = 'force-dynamic';

import { eventBus } from '@/lib/event-bus';
import { startActivity } from '@/lib/activity-engine';

const encoder = new TextEncoder();

export async function GET(): Promise<Response> {
  let timer: ReturnType<typeof setInterval> | null = null;
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Ensure the activity engine is running (idempotent).
      startActivity();

      // Send an initial comment to establish the connection
      controller.enqueue(encoder.encode(':ok\n\n'));

      // Subscribe to the event bus — forward every event as an SSE frame.
      cleanup = eventBus.subscribe((event) => {
        try {
          controller.enqueue(encoder.encode(`event: orqenix\ndata: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream likely closed
        }
      });

      // Keepalive heartbeat so browsers don't timeout
      timer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`:keepalive ${Date.now()}\n\n`));
        } catch {
          if (timer) clearInterval(timer);
        }
      }, 15_000);
    },
    cancel() {
      if (cleanup) cleanup();
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Connection: 'keep-alive',
    },
  });
}
