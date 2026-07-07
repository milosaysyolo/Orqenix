// SPDX-License-Identifier: Apache-2.0
// Workbench , Observer config API (opt-out toggle per scope)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET ?scope=project&id=... , read observer config */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "project";
  const id = url.searchParams.get("id") ?? "";
  // D8.γ: const observer = new Observer({ db }); return observer.getConfig(scope, id);
  return NextResponse.json(
    {
      scope,
      id,
      config: { enabled: true, piiFilterEnabled: true, notifyOnFirstLaunch: true, sampleRate: 1.0 },
      note: "Observer config wires at runtime",
    },
    { status: 200 },
  );
}

/** POST , toggle observer enabled for a scope */
export async function POST(req: Request) {
  let body: { scope?: string; id?: string; enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.scope || body.id === undefined || body.enabled === undefined) {
    return NextResponse.json({ error: "Requires scope + id + enabled" }, { status: 400 });
  }
  // D8.γ: observer.setConfig(scope, id, { enabled }); audit observer.config_changed
  return NextResponse.json(
    { ok: true, scope: body.scope, id: body.id, enabled: body.enabled },
    { status: 200 },
  );
}
