import { getSubagents, createSubagent } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({ subagents: getSubagents() });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { name, role, status, uptime, tasksCompleted } = body;
    const agent = createSubagent({
      name: name ?? 'new-agent',
      role: role ?? '',
      status: status ?? 'idle',
      uptime: uptime ?? '0m',
      tasksCompleted: tasksCompleted ?? 0,
    });
    return Response.json({ subagent: agent }, { status: 201 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}
