// SPDX-License-Identifier: Apache-2.0
// Phase 3: wired to @orqenix/settings-registry
//
// GET  → returns all settings groups resolved through the real registry
// POST → update or reset a setting at the 'project' layer

export const dynamic = 'force-dynamic';

import {
  getAllSettingsGroups,
  updateSetting,
  revertSetting,
} from '@/lib/engine-init';

export async function GET(): Promise<Response> {
  try {
    const groups = await getAllSettingsGroups();
    return Response.json({ groups });
  } catch (err) {
    console.error('[settings/GET]', err);
    return Response.json(
      { error: 'Failed to resolve settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      moduleId?: unknown;
      key?: unknown;
      value?: unknown;
    };

    if (typeof body.moduleId !== 'string' || typeof body.key !== 'string') {
      return Response.json(
        { error: 'moduleId and key required as strings' },
        { status: 400 }
      );
    }

    if (body.action === 'update') {
      await updateSetting(body.moduleId, body.key, body.value);
      return Response.json({
        ok: true,
        moduleId: body.moduleId,
        key: body.key,
        value: body.value,
      });
    }

    if (body.action === 'reset') {
      await revertSetting(body.moduleId, body.key);
      return Response.json({
        ok: true,
        moduleId: body.moduleId,
        key: body.key,
        reset: true,
      });
    }

    return Response.json({ error: 'unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[settings/POST]', err);
    return Response.json(
      { error: 'Failed to update setting' },
      { status: 500 }
    );
  }
}
