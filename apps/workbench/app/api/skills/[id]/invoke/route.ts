// SPDX-License-Identifier: Apache-2.0

import { getSkills } from '@/lib/demo-store';
import { eventBus } from '@/lib/event-bus';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const skills = getSkills();
  const skill = skills.find((s) => s.id === id);
  if (!skill) return Response.json({ error: 'skill not found' }, { status: 404 });

  let prompt = '';
  try {
    const body = await req.json();
    prompt = String(body.prompt ?? '');
  } catch {
    // no body — fine
  }

  // Simulate execution
  const result = {
    ok: true,
    skillId: id,
    skillName: skill.name,
    prompt: prompt.slice(0, 200),
    output: `[simulated] ${skill.name} executed with prompt: "${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}"`,
    durationMs: Math.floor(Math.random() * 800) + 200,
  };

  eventBus.emit({
    kind: 'session.updated',
    actor: 'system',
    payload: { op: 'skill.invoke', id, name: skill.name, output: result.output },
  });

  return Response.json(result);
}
