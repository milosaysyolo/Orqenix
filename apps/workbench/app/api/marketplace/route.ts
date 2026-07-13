// SPDX-License-Identifier: Apache-2.0

import { getMarketplace, toggleInstall, syncMarketplaceInstall, syncMarketplaceUninstall } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

const ALL_KINDS = [
  'knowledge-source', 'embedding-model', 'reranker', 'compression-strategy',
  'memory-injection-strategy', 'prompt-rewriter', 'visualization', 'code-analyzer',
  'kb-schema', 'mcp-server', 'agent', 'subagent', 'skill', 'agent-binding',
] as const;

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');
  const q = url.searchParams.get('q')?.toLowerCase();
  const tab = url.searchParams.get('tab') ?? 'discover';

  let items = getMarketplace();

  // Filter by tab
  if (tab === 'installed') {
    items = items.filter((i) => i.installed);
  }

  // Filter by kind
  if (kind && kind !== 'all') {
    items = items.filter((i) => i.kind === kind);
  }

  // Search
  if (q) {
    items = items.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.author.toLowerCase().includes(q)
    );
  }

  return Response.json({ items, kinds: ALL_KINDS });
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { action?: string; name?: unknown };
  if (body.action === 'install' || body.action === 'uninstall') {
    if (typeof body.name !== 'string') {
      return Response.json({ error: 'name required as string' }, { status: 400 });
    }
    toggleInstall(body.name);
    if (body.action === 'install') syncMarketplaceInstall(body.name);
    else syncMarketplaceUninstall(body.name);
    const installed = body.action === 'install';
    return Response.json({ ok: true, name: body.name, installed });
  }
  return Response.json({ error: 'unknown action' }, { status: 400 });
}
