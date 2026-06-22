import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rt = await getRuntime();
    const db = rt.engine.getStore().db;
    let branches: Array<Record<string, unknown>> = [];
    try {
      branches = db.prepare('SELECT branch_id, branch_name, created_at, cloned_from_branch_id FROM branches WHERE project_id=? ORDER BY created_at').all(rt.projectId) as never;
    } catch { /* */ }
    const withCounts = branches.map((b) => {
      let sessions = 0;
      try { sessions = (db.prepare('SELECT COUNT(*) AS c FROM sessions WHERE branch_id=?').get(b.branch_id) as { c: number }).c; } catch { /* */ }
      return { ...b, sessions };
    });
    return NextResponse.json({ branches: withCounts }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action: 'create'; parentBranchId: string; newBranchName: string };
    const rt = await getRuntime();
    if (body.action === 'create') {
      const result = await rt.engine.createBranch({ parentBranchId: body.parentBranchId, newBranchName: body.newBranchName });
      return NextResponse.json({ ok: true, branchId: (result as { branchId?: string }).branchId, indexRowsCloned: (result as { indexRowsCloned?: number }).indexRowsCloned ?? 0 });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
