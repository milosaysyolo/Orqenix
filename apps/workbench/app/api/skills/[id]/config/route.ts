// SPDX-License-Identifier: Apache-2.0

import { getSkills, updateSkill } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const skills = getSkills();
  const skill = skills.find((s) => s.id === id);
  if (!skill) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ config: skill.config ?? '' });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  try {
    const body = await req.json();
    const config = String(body.config ?? '');
    const updated = updateSkill(id, { config });
    if (!updated) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}
