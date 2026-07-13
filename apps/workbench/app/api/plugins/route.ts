// SPDX-License-Identifier: Apache-2.0
// Phase 4: wired to @orqenix/plugin-core (demo-store fallback)

export const dynamic = 'force-dynamic';

import { getAllPlugins, createPluginItem } from '@/lib/engine-init';

export async function GET(): Promise<Response> {
  try {
    const plugins = await getAllPlugins();
    return Response.json({ plugins });
  } catch {
    return Response.json({ plugins: [] });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { name, version, enabled, description, author } = body;
    const plugin = await createPluginItem({
      name: name ?? 'new-plugin',
      version: version ?? '1.0.0',
      enabled: enabled ?? true,
      description: description ?? '',
      author: author ?? 'user',
    });
    return Response.json({ plugin }, { status: 201 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}
