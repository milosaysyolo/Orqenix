// SPDX-License-Identifier: Apache-2.0

'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';

type BindingPlatform = 'claude-code' | 'cursor' | 'cline' | 'codex' | 'continue' | 'aider' | 'opencode';

interface Binding {
  platform: BindingPlatform;
  state: 'not_installed' | 'active';
  configPath?: string;
}

const PLATFORM_META: Record<BindingPlatform, { label: string; glyph: string }> = {
  'claude-code': { label: 'Claude Code', glyph: '\uD83E\uDD16' },
  'cursor': { label: 'Cursor', glyph: '\u2328' },
  'cline': { label: 'Cline', glyph: '\u2699' },
  'codex': { label: 'Codex', glyph: '\u2728' },
  'continue': { label: 'Continue', glyph: '\u25B6' },
  'aider': { label: 'Aider', glyph: '\u269B' },
  'opencode': { label: 'OpenCode', glyph: '\u2B50' },
};

export default function BindingsPage() {
  const { toast } = useToast();
  const [bindings, setBindings] = React.useState<Binding[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [testResult, setTestResult] = React.useState<{ platform: string; capabilities: { tools: number; resources: number; prompts: number } } | null>(null);

  const load = React.useCallback(async () => {
    const res = await api.get<{ bindings: Binding[] }>('/api/agents/bindings');
    if (res.ok) setBindings(res.data!.bindings);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function handleInstall(platform: string) {
    setBusy(platform);
    const res = await api.post('/api/agents/bindings', { action: 'install', platform });
    setBusy(null);
    if (res.ok) {
      toast({ title: 'Installed', message: `${platform} binding activated`, tone: 'success' });
      await load();
    } else {
      toast({ title: 'Failed', message: res.error ?? 'unknown', tone: 'error' });
    }
  }

  async function handleUninstall(platform: string) {
    setBusy(platform);
    const res = await api.post('/api/agents/bindings', { action: 'uninstall', platform });
    setBusy(null);
    if (res.ok) {
      toast({ title: 'Uninstalled', message: `${platform} binding removed`, tone: 'info' });
      await load();
    } else {
      toast({ title: 'Failed', message: res.error ?? 'unknown', tone: 'error' });
    }
  }

  async function handleTest(platform: string) {
    setBusy(platform);
    const res = await api.post<{ ok: boolean; capabilities: { tools: number; resources: number; prompts: number } }>('/api/agents/bindings', { action: 'test', platform });
    setBusy(null);
    if (res.ok && res.data) {
      setTestResult({ platform, capabilities: res.data.capabilities });
    } else {
      toast({ title: 'Test failed', message: res.error ?? 'unknown', tone: 'error' });
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <SectionTitle sub="Bridge Orqenix into your agent platforms (Apache-2.0, no lock-in)">Bindings</SectionTitle>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bindings.length === 0 ? (
          <Card className="col-span-full p-10 text-center font-mono text-[11px] text-[var(--faint)]">
            No bindings configured.
          </Card>
        ) : bindings.map((b) => {
          const meta = PLATFORM_META[b.platform] ?? { label: b.platform, glyph: '?' };
          const isActive = b.state === 'active';
          return (
            <Card key={b.platform} className={'p-4 transition-colors ' + (isActive ? 'border-[color-mix(in_oklab,var(--olive)25%,transparent)]' : '')}>
              <div className="flex items-center gap-2">
                <span className="text-[20px]">{meta.glyph}</span>
                <span className="font-mono text-[13px] font-bold text-[var(--ink)]">{meta.label}</span>
                <Badge tone={isActive ? 'olive' : 'neutral'}>{isActive ? 'active' : 'not installed'}</Badge>
              </div>
              {b.configPath && (
                <div className="mt-2 font-mono text-[9.5px] text-[var(--dim)]">
                  config: <span className="text-[var(--ink)]">{b.configPath}</span>
                </div>
              )}
              <div className="mt-4 flex gap-2">
                {isActive ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleTest(b.platform)} disabled={busy === b.platform}>
                      {busy === b.platform ? '\u2026' : 'Test'}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleUninstall(b.platform)} disabled={busy === b.platform}>
                      {busy === b.platform ? '\u2026' : 'Uninstall'}
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => handleInstall(b.platform)} disabled={busy === b.platform}>
                    {busy === b.platform ? '\u2026' : 'Install'}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Test result modal */}
      {testResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setTestResult(null)}>
          <Card className="w-80 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[13px] font-bold text-[var(--ink)]">{PLATFORM_META[testResult.platform as BindingPlatform]?.label ?? testResult.platform}</span>
              <button onClick={() => setTestResult(null)} className="font-mono text-[14px] text-[var(--faint)]">&times;</button>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between rounded-[7px] bg-[var(--paper2)] px-3 py-2">
                <span className="font-mono text-[11px] text-[var(--dim)]">Tools</span>
                <span className="font-mono text-[14px] font-bold text-[var(--olive)]">{testResult.capabilities.tools}</span>
              </div>
              <div className="flex items-center justify-between rounded-[7px] bg-[var(--paper2)] px-3 py-2">
                <span className="font-mono text-[11px] text-[var(--dim)]">Resources</span>
                <span className="font-mono text-[14px] font-bold text-[var(--teal)]">{testResult.capabilities.resources}</span>
              </div>
              <div className="flex items-center justify-between rounded-[7px] bg-[var(--paper2)] px-3 py-2">
                <span className="font-mono text-[11px] text-[var(--dim)]">Prompts</span>
                <span className="font-mono text-[14px] font-bold text-[var(--plum)]">{testResult.capabilities.prompts}</span>
              </div>
            </div>
            <div className="mt-3 text-center font-mono text-[9.5px] text-[var(--faint)]">Connection verified</div>
          </Card>
        </div>
      )}
    </div>
  );
}
