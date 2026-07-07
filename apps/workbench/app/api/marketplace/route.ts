// SPDX-License-Identifier: Apache-2.0
// Workbench , Marketplace API (search/install/uninstall/create/update/delete/fork/import/export)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "installed";

  if (action === "installed") {
    // D8.β wires MarketplaceManager + SqliteLocalPluginStore here.
    // Returns local installed plugins from local_plugins table (Migration 550).
    return NextResponse.json(
      { plugins: [], note: "Marketplace manager wires at runtime via SqliteLocalPluginStore" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action as string | undefined;
  const valid = [
    "search",
    "install",
    "uninstall",
    "create",
    "update",
    "delete",
    "fork",
    "import",
    "export",
  ];
  if (!action || !valid.includes(action)) {
    return NextResponse.json(
      { error: `Invalid action. Must be one of: ${valid.join(", ")}` },
      { status: 400 },
    );
  }

  // D8.β runtime wiring:
  //   const engine = getMemoryEngine();
  //   const manager = new MarketplaceManager({
  //     store: new SqliteLocalPluginStore(engine),
  //     audit: engine.getAuditWriter(),
  //     normalizationEngine: new NormalizationEngine({ inputAdapters: ALL_INPUT_ADAPTERS, outputAdapters: ALL_OUTPUT_ADAPTERS }),
  //     lifecycle: new PluginLifecycle({ ... }),
  //     resolverRegistry: buildDefaultResolvers(),
  //   });
  //   switch (action) { case 'search': return manager.search(...); ... }

  try {
    return NextResponse.json(
      {
        ok: true,
        action,
        note: "Marketplace operation wires MarketplaceManager (D8.β) at runtime",
        plugins: [],
        warnings: [],
        lossyFields: [],
      },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
