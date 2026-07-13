// SPDX-License-Identifier: Apache-2.0

import { getBindings, setBindingState } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

const ALL_PLATFORMS = ['claude-code', 'cursor', 'cline', 'codex', 'continue', 'aider', 'opencode'] as const;

export async function GET(): Promise<Response> {
  const installed = getBindings();
  const bindings = ALL_PLATFORMS.map((platform) => {
    const found = installed.find((b) => b.platform === platform);
    return found ?? { platform, state: 'not_installed' as const };
  });
  return Response.json({ bindings });
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    platform?: unknown;
  };
  if (typeof body.platform !== 'string' || !ALL_PLATFORMS.includes(body.platform as typeof ALL_PLATFORMS[number])) {
    return Response.json({ error: 'valid platform required' }, { status: 400 });
  }
  const platform = body.platform as string;

  if (body.action === 'install') {
    const configPath = platform === 'claude-code' ? '.mcp.json' : `.${platform}/mcp.json`;
    setBindingState(platform, 'active', configPath);
    return Response.json({ ok: true, platform, state: 'active', configPath });
  }
  if (body.action === 'uninstall') {
    setBindingState(platform, 'not_installed');
    return Response.json({ ok: true, platform, state: 'not_installed' });
  }
  if (body.action === 'test') {
    return Response.json({ ok: true, platform, capabilities: { tools: 10, resources: 9, prompts: 6 } });
  }
  return Response.json({ error: 'unknown action' }, { status: 400 });
}
