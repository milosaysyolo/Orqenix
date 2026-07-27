// SPDX-License-Identifier: Apache-2.0
// Phase 4: skill invocation via demo-store simulation

export const dynamic = 'force-dynamic';

import { invokeSkill } from '@/lib/engine-init';
import { eventBus } from '@/lib/event-bus';

export async function POST(
  req: Request, { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  let prompt = '';
  try {
    const body = await req.json();
    prompt = String(body.prompt ?? '');
  } catch {
    // no body — fine
  }

  const result = await invokeSkill(id, prompt);
  if (!result) return Response.json({ error: 'skill not found' }, { status: 404 });

  eventBus.emit({
    kind: 'session.updated',
    actor: 'system',
    payload: { op: 'skill.invoke', id, name: result.skillName, output: result.output },
  });

  return Response.json(result);
}
