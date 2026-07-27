// SPDX-License-Identifier: Apache-2.0

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({ agents: [] });
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  return Response.json({ ok: true, agent: body });
}
