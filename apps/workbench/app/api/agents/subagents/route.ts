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
    console.error('[agents/subagents]', e);
    return Response.json({ error: 'Failed to create subagent' }, { status: 400 });
  }
}
