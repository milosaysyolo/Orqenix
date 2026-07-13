// SPDX-License-Identifier: Apache-2.0

import { resetStore } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  resetStore();
  return Response.json({ ok: true, seeded: { memoryEntries: 10, sessions: 3, plugins: 4, candidates: 3 } });
}
