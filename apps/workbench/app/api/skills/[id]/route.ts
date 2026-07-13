import { getSkills, updateSkill, deleteSkill } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const skills = getSkills();
  const skill = skills.find((s) => s.id === id);
  if (!skill) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ skill });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  try {
    const body = await req.json();
    const updated = updateSkill(id, body);
    if (!updated) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json({ skill: updated });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const ok = deleteSkill(id);
  if (!ok) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ ok: true });
}
