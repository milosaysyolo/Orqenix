// SPDX-License-Identifier: Apache-2.0

import { getLibrary, pinEntry, unpinEntry } from '@/lib/demo-store';
import type { KbKind } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return Response.json({ items: getLibrary() });
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { entryId?: unknown; entryKb?: unknown };
  if (typeof body.entryId !== 'string' || typeof body.entryKb !== 'string')
    return Response.json({ error: 'entryId and entryKb required as strings' }, { status: 400 });
  const ok = pinEntry(body.entryId, body.entryKb as KbKind);
  return Response.json({ ok });
}

export async function DELETE(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { entryId?: unknown };
  if (typeof body.entryId !== 'string') return Response.json({ error: 'entryId required as string' }, { status: 400 });
  const ok = unpinEntry(body.entryId);
  return Response.json({ ok });
}
