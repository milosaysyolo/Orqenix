import { getSkills, createSkill } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({ skills: getSkills() });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { name, category, version, enabled, description } = body;
    const skill = createSkill({
      name: name ?? 'new-skill',
      category: category ?? 'general',
      version: version ?? '1.0.0',
      enabled: enabled ?? true,
      description: description ?? '',
    });
    return Response.json({ skill }, { status: 201 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}
