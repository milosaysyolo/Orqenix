// SPDX-License-Identifier: Apache-2.0
// Workbench , Self-Learning candidates API (list + review)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/learning/candidates , list candidates for review */
export async function GET() {
  // D8.γ runtime wiring:
  //   const engine = getMemoryEngine();
  //   const service = new PromoterService({ db: engine.getStore().db, audit: engine.getAuditWriter() });
  //   const candidates = await service.listForReview(projectId);
  return NextResponse.json(
    { candidates: [], note: "PromoterService wires at runtime via memory-engine db" },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

/** POST /api/learning/candidates , execute a review decision */
export async function POST(req: Request) {
  let body: { candidateId?: string; action?: string; reviewedBy?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const valid = ["promote", "promote_customize", "reject", "defer"];
  if (!body.action || !valid.includes(body.action)) {
    return NextResponse.json(
      { error: `Invalid action. Must be: ${valid.join(", ")}` },
      { status: 400 },
    );
  }
  if (!body.candidateId) {
    return NextResponse.json({ error: "Missing candidateId" }, { status: 400 });
  }

  // D8.γ runtime:
  //   const result = await service.review({ candidateId, action, reviewedBy, reason }, projectId);
  return NextResponse.json(
    {
      ok: true,
      candidateId: body.candidateId,
      action: body.action,
      openBuilder: body.action === "promote_customize",
      note: "PromoterService.review wires at runtime",
    },
    { status: 200 },
  );
}
