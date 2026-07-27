import { getAudit } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const entries = getAudit();
  return Response.json({ entries, verification: { valid: entries.every((a) => a.valid), firstMismatchSeq: null, entriesVerified: entries.length } });
}
