// SPDX-License-Identifier: Apache-2.0
// Phase 4: wired through engine-init (demo-store fallback)

export const dynamic = 'force-dynamic';

import { getAllSkills, updateSkillItem, deleteSkillItem } from '@/lib/engine-init';

export async function GET(
  _req: Request, { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const skills = await getAllSkills();
  const skill = skills.find((s) => s.id === id);
  if (!skill) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ skill });
}

export async function PUT(
  req: Request, { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  try {
    const body = await req.json();
    const updated = await updateSkillItem(id, body);
    if (!updated) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json({ skill: updated });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request, { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const ok = await deleteSkillItem(id);
  if (!ok) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ ok: true });
}
