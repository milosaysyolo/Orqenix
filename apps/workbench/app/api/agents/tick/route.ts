// SPDX-License-Identifier: Apache-2.0

export const dynamic = 'force-dynamic';

export async function POST(_req: Request): Promise<Response> {
  return Response.json({ ok: true, tick: Date.now() });
}
