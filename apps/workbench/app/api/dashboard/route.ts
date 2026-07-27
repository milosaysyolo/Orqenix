// SPDX-License-Identifier: Apache-2.0

import { getDashboard } from '@/lib/demo-store';
import { getEngineStatus } from '@/lib/engine-init';
import type { SubsystemStatus } from '@/lib/engine-init';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const data = getDashboard();
  const subs = getEngineStatus();
  const engineStatus: SubsystemStatus = Object.values(subs).some((s) => s === 'demo') ? 'demo' : 'real';
  return Response.json({ ...data, engineStatus });
}
