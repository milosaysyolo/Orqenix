// SPDX-License-Identifier: Apache-2.0

import { getSandboxPlugins } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({ plugins: getSandboxPlugins() });
}
