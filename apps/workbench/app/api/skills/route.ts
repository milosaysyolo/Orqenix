// SPDX-License-Identifier: Apache-2.0
// Phase 4: wired through engine-init to @orqenix/skill-genesis (demo-store fallback)

export const dynamic = 'force-dynamic';

import { getAllSkills, createSkillItem } from '@/lib/engine-init';

export async function GET(): Promise<Response> {
  try {
    const skills = await getAllSkills();
    return Response.json({ skills });
  } catch {
    return Response.json({ skills: [] });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { name, category, version, enabled, description } = body;
    const skill = await createSkillItem({
      name: name ?? 'new-skill',
      category: category ?? 'general',
      version: version ?? '1.0.0',
      enabled: enabled ?? true,
      description: description ?? '',
    });
    return Response.json({ skill }, { status: 201 });
  } catch (e) {
    console.error('[skills]', e);
    return Response.json({ error: 'Failed to create skill' }, { status: 400 });
  }
}
