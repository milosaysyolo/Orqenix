// SPDX-License-Identifier: Apache-2.0
// Settings API , resolve + update + export
//
// Bridges Workbench Settings UI to @orqenix/settings-registry.
// D8.α.6 wires the SQLite-backed persistence; D8.α.5 provides the API shape.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/settings
 *   ?action=resolve&moduleId=...&path=...&projectId=...   → resolve a setting
 *   ?action=list                                          → list all contracts
 *   ?action=export&level=all&format=yaml                  → export settings
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "list";

  try {
    // D8.α.6 wires the shared registry singleton backed by SQLite:
    //   const registry = getSettingsRegistry();
    //   await bootstrapSettings(registry);  (or modules self-register)

    switch (action) {
      case "list": {
        // D8.α.5 stub: returns the static contract catalog shape
        return NextResponse.json(
          {
            contracts: [],
            note: "Settings registry singleton wires in D8.α.6 (SQLite-backed persistence)",
          },
          { status: 200, headers: { "Cache-Control": "no-store" } },
        );
      }

      case "resolve": {
        const moduleId = url.searchParams.get("moduleId");
        const path = url.searchParams.get("path");
        if (!moduleId || !path) {
          return NextResponse.json(
            { error: "resolve requires moduleId and path params" },
            { status: 400 },
          );
        }
        // D8.α.6: const resolved = await registry.resolve(moduleId, path, ctx);
        return NextResponse.json(
          {
            moduleId,
            path,
            note: "Resolution wires in D8.α.6",
          },
          { status: 200 },
        );
      }

      case "export": {
        const level = url.searchParams.get("level") ?? "all";
        const format = url.searchParams.get("format") ?? "yaml";
        // D8.α.6: const data = await exportSettings(registry, { level, format });
        return NextResponse.json(
          {
            level,
            format,
            note: "Export wires in D8.α.6",
          },
          { status: 200 },
        );
      }

      default:
        return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/settings
 *   Body: { action: 'update' | 'revert' | 'import', ... }
 */
export async function POST(req: Request) {
  let body: {
    action?: string;
    moduleId?: string;
    path?: string;
    value?: unknown;
    level?: string;
    hierarchyId?: string;
    serialized?: string;
    mode?: "merge" | "replace";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action } = body;
  if (!action) {
    return NextResponse.json({ error: "Missing required field: action" }, { status: 400 });
  }

  const validActions = ["update", "revert", "import"];
  if (!validActions.includes(action)) {
    return NextResponse.json(
      { error: `Invalid action '${action}'. Must be one of: ${validActions.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    // D8.α.6 wires the actual registry operations:
    //
    //   case 'update': await registry.update(body.moduleId, body.path, body.value,
    //                    { level: body.level, hierarchyId: body.hierarchyId });
    //   case 'revert': await registry.revert(body.moduleId, body.path,
    //                    { level: body.level, hierarchyId: body.hierarchyId });
    //   case 'import': await importSettings(registry, body.serialized, { mode: body.mode });

    return NextResponse.json(
      {
        ok: true,
        action,
        note: "Settings mutation wires in D8.α.6 (SQLite persistence + hot-reload)",
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
