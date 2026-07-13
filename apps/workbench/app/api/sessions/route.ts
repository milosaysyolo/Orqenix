// SPDX-License-Identifier: Apache-2.0

import { getSessions, startSession, resumeSession, pauseSession, abortSession, promoteSessionMemory } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({ sessions: getSessions() });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const action = body?.action;
    switch (action) {
      case 'start': {
        if (!body?.agentName || !body?.agentPlatform) return Response.json({ error: 'agentName and agentPlatform required' }, { status: 400 });
        const sess = startSession(body.agentName, body.agentPlatform, body.parentSessionId);
        return Response.json({ ok: true, session: sess });
      }
      case 'resume': {
        if (!body?.id) return Response.json({ error: 'id required' }, { status: 400 });
        return Response.json({ ok: resumeSession(body.id) });
      }
      case 'pause': {
        if (!body?.id) return Response.json({ error: 'id required' }, { status: 400 });
        return Response.json({ ok: pauseSession(body.id) });
      }
      case 'abort': {
        if (!body?.id) return Response.json({ error: 'id required' }, { status: 400 });
        return Response.json({ ok: abortSession(body.id) });
      }
      case 'promote': {
        if (!body?.id) return Response.json({ error: 'id required' }, { status: 400 });
        const promoted = promoteSessionMemory(body.id);
        return Response.json({ ok: true, promoted });
      }
      default:
        return Response.json({ error: `unknown action: ${action}` }, { status: 400 });
    }
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
}
