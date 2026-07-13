// SPDX-License-Identifier: Apache-2.0

import { resetStore } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  resetStore();
  return Response.json({ ok: true, cleared: 14 });
}
