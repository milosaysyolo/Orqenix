import { getCandidates } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const candidates = getCandidates().filter((c) => c.status === 'approved');
  return Response.json({ verifications: candidates.map((c) => ({
    id: c.id, name: c.name, status: 'pending', successRate: c.successRate, replayCount: c.count,
  })) });
}
