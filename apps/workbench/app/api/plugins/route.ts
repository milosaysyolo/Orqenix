// SPDX-License-Identifier: Apache-2.0
// Plugin management API , list + install + lifecycle operations
//
// Bridges Workbench UI to @orqenix/plugin-core. D8.α.6 wires the persistent
// registry (SQLite) + sandbox manager; D8.α.4 provides the API shape.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/plugins
 * Returns the list of installed plugins.
 *
 * D8.α.6 wires this to PluginRegistry backed by .orqenix/marketplace.sqlite.
 * For D8.α.4, returns an empty list (registry persistence not yet wired).
 */
export async function GET() {
  try {
    const plugins: unknown[] = [];

    return NextResponse.json(
      {
        plugins,
        count: plugins.length,
        note: 'Plugin registry persistence wires in D8.α.6 (Memory Engine + SQLite)',
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/plugins
 * Install / activate / deactivate / uninstall a plugin.
 *
 * Body: { action: 'install' | 'activate' | 'deactivate' | 'uninstall', ... }
 */
export async function POST(req: Request) {
  let body: { action?: string; packagePath?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { action } = body;
  if (!action) {
    return NextResponse.json(
      { error: 'Missing required field: action' },
      { status: 400 }
    );
  }

  const validActions = ['install', 'activate', 'deactivate', 'uninstall', 'validate'];
  if (!validActions.includes(action)) {
    return NextResponse.json(
      { error: `Invalid action '${action}'. Must be one of: ${validActions.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(
      {
        ok: true,
        action,
        note: 'Plugin lifecycle execution wires in D8.α.6 (Memory Engine + audit chain + sandbox runtime)',
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
