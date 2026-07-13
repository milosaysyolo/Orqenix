// SPDX-License-Identifier: Apache-2.0

import { getDashboard } from '@/lib/demo-store';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json(getDashboard());
}
