// SPDX-License-Identifier: Apache-2.0

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  return Response.json({ ok: true, runId: crypto.randomUUID(), ...body });
}
