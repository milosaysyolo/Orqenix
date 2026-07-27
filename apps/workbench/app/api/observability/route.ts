import { queryEntries, getSessions, getPlugins, getCandidates, getAudit } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const entries = queryEntries();
  const sessions = getSessions();
  const plugins = getPlugins();
  const candidates = getCandidates();
  const audit = getAudit();

  const kbCounts: Record<string, number> = {};
  for (const e of entries) {
    kbCounts[e.kb] = (kbCounts[e.kb] ?? 0) + 1;
  }

  return Response.json({
    total: entries.length,
    kbCounts,
    sessions: { active: sessions.filter((s) => s.state === 'running').length, total: sessions.length },
    plugins: plugins.length,
    candidates: candidates.length,
    auditLen: audit.length,
    latency: { queryMs: 42, sloMs: 100, pass: true },
  });
}
