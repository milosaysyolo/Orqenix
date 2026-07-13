// SPDX-License-Identifier: Apache-2.0

import { getTeam, saveTeam, type TeamNode, type TeamEdge } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json(getTeam());
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(body.nodes) || !Array.isArray(body.edges))
    return Response.json({ error: 'nodes and edges required as arrays' }, { status: 400 });
  saveTeam({ nodes: body.nodes as TeamNode[], edges: body.edges as TeamEdge[] });
  return Response.json({ ok: true });
}
