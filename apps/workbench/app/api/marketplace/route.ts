// SPDX-License-Identifier: Apache-2.0
// Phase 4: wired to @orqenix/marketplace-core (demo-store fallback)

export const dynamic = 'force-dynamic';

import { getMarketplaceItems, marketplaceInstall, marketplaceUninstall } from '@/lib/engine-init';

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind') ?? undefined;
  const q = url.searchParams.get('q') ?? undefined;
  const tab = url.searchParams.get('tab') ?? 'discover';

  try {
    const { items, kinds } = await getMarketplaceItems(kind, q, tab);
    return Response.json({ items, kinds });
  } catch {
    return Response.json({ items: [], kinds: [] });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string; name?: unknown };
    if (body.action === 'install' || body.action === 'uninstall') {
      if (typeof body.name !== 'string') {
        return Response.json({ error: 'name required as string' }, { status: 400 });
      }
      const installed = body.action === 'install';
      if (installed) await marketplaceInstall(body.name);
      else await marketplaceUninstall(body.name);
      return Response.json({ ok: true, name: body.name, installed });
    }
    return Response.json({ error: 'unknown action' }, { status: 400 });
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
}
