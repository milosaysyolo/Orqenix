import { getSessions } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const sessions = getSessions().filter((s) => s.state === 'running' || s.state === 'paused');
  return Response.json({ sessions });
}
