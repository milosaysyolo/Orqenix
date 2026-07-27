'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { Modal } from '@/components/modal';
import { api } from '@/lib/api';
import { useLiveEvents } from '@/lib/use-live-events';

interface McpData {
  status: string; endpoint: string;
  transports: Array<{ kind: string; state: string; port?: number }>;
  tools: Array<{ name: string; description: string; permission: string }>;
  resources: Array<{ uri: string; description: string }>;
  prompts: Array<{ name: string; description: string }>;
  tokens: Array<{ id: string; client: string; scopes_json: string; expires_at: string }>;
}

function daysAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function safeParseScopes(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function McpPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<McpData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<'tools' | 'resources' | 'prompts'>('tools');
  const [busyRevoke, setBusyRevoke] = React.useState<string | null>(null);
  const [issuing, setIssuing] = React.useState(false);
  const [showIssue, setShowIssue] = React.useState(false);
  const [newClient, setNewClient] = React.useState('');
  const [newScopes, setNewScopes] = React.useState('memory.read,memory.write');
  // Revoke confirm
  const [confirmRevoke, setConfirmRevoke] = React.useState<string | null>(null);
  // Search filter
  const [searchQuery, setSearchQuery] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await api.get<McpData>('/api/agents/mcp');
    if (res.ok) setData(res.data!);
    setLoading(false);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const { latest: liveEvent } = useLiveEvents(['session.updated', 'runtime.ready']);
  React.useEffect(() => {
    if (liveEvent) void load();
  }, [liveEvent, load]);

  async function handleRevoke(id: string) {
    setConfirmRevoke(null);
    setBusyRevoke(id);
    const res = await api.del(`/api/agents/mcp/tokens/${id}`);
    setBusyRevoke(null);
    if (res.ok) {
      setData((prev) => prev ? { ...prev, tokens: prev.tokens.filter((t) => t.id !== id) } : prev);
      toast({ tone: 'info', title: 'Revoked', message: `Token ${id} revoked` });
    } else {
      toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' });
    }
  }

  async function handleIssue() {
    if (!newClient.trim()) return;
    setIssuing(true);
    const scopes = newScopes.split(',').map((s) => s.trim()).filter(Boolean);
    const res = await api.post<{ ok: boolean; token: { id: string; client: string; scopes_json: string; expires_at: string } }>('/api/agents/mcp/tokens', { client: newClient, scopes });
    setIssuing(false);
    if (res.ok && res.data) {
      setData((prev) => prev ? { ...prev, tokens: [...prev.tokens, res.data!.token] } : prev);
      toast({ tone: 'success', title: 'Issued', message: `Token for ${newClient}` });
      setShowIssue(false);
      setNewClient('');
    } else {
      toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' });
    }
  }

  // Filter lists by search query
  const filteredTools = React.useMemo(() => {
    if (!data || !searchQuery) return data?.tools ?? [];
    const q = searchQuery.toLowerCase();
    return data.tools.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
  }, [data, searchQuery]);

  const filteredResources = React.useMemo(() => {
    if (!data || !searchQuery) return data?.resources ?? [];
    const q = searchQuery.toLowerCase();
    return data.resources.filter((r) => r.uri.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }, [data, searchQuery]);

  const filteredPrompts = React.useMemo(() => {
    if (!data || !searchQuery) return data?.prompts ?? [];
    const q = searchQuery.toLowerCase();
    return data.prompts.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }, [data, searchQuery]);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <SectionTitle sub="The substrate your agents reach into">MCP Server</SectionTitle>

      {/* Loading state */}
      {loading ? (
        <Card className="mt-4 p-6 animate-pulse">
          <div className="h-5 w-48 rounded bg-[var(--line)]" />
          <div className="mt-3 h-4 w-32 rounded bg-[var(--line)]" />
        </Card>
      ) : !data ? (
        <Card className="mt-4 p-6 text-center font-mono text-[11px] text-[var(--faint)]">
          Failed to connect to MCP server. Check that the service is running.
        </Card>
      ) : (
        <>
          {/* Status header */}
          <Card className="mt-4 flex flex-wrap items-center gap-4 p-4">
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${data.status === 'running' ? 'animate-pulse bg-[var(--olive)]' : 'bg-[var(--rust)]'}`} />
              <span className="font-mono text-[12px] font-bold text-[var(--ink)]">orqenix-mcp</span>
            </span>
            <Badge tone={data.status === 'running' ? 'olive' : 'neutral'}>{data.status}</Badge>
            <span className="font-mono text-[11px] text-[var(--dim)]">{data.endpoint}</span>
            <div className="ml-auto flex gap-2">
              <Badge tone="rust">{data.tools.length} Tools</Badge>
              <Badge tone="teal">{data.resources.length} Resources</Badge>
              <Badge tone="plum">{data.prompts.length} Prompts</Badge>
            </div>
          </Card>

          {/* Transport badges */}
          <div className="mt-3 flex gap-2">
            {(data.transports ?? []).length === 0 ? (
              <span className="font-mono text-[10px] text-[var(--faint)]">No transports configured.</span>
            ) : (data.transports ?? []).map((t) => (
              <Badge key={t.kind} tone={t.state === 'connected' ? 'olive' : 'neutral'}>
                <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${t.state === 'connected' ? 'bg-[var(--olive)]' : t.state === 'reconnecting' ? 'bg-[var(--amber)] animate-pulse' : 'bg-[var(--faint)]'}`} />
                {t.kind}{t.port ? `:${t.port}` : ''} &middot; {t.state}
              </Badge>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-[1fr_320px] gap-4">
            {/* Tab panel */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                {(['tools', 'resources', 'prompts'] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={'rounded-[9px] px-3 py-1 font-mono text-[11px] font-semibold capitalize ' +
                      (tab === t ? 'bg-[var(--card)] border border-[var(--line2)] text-[var(--ink)]' : 'text-[var(--dim)]')}>{t}</button>
                ))}
                {/* Search filter */}
                <div className="relative ml-auto">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-[var(--faint)]">{'\u2315'}</span>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter…"
                    className="w-[160px] rounded-[7px] border border-[var(--line)] bg-[var(--card)] pl-6 pr-2 py-1 font-mono text-[10px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
                  />
                </div>
              </div>
              <Card className="divide-y divide-[var(--line)]">
                {tab === 'tools' && filteredTools.length === 0 && (
                  <div className="p-6 text-center font-mono text-[11px] text-[var(--faint)]">
                    {searchQuery ? 'No tools match your filter.' : 'No tools available.'}
                  </div>
                )}
                {tab === 'tools' && filteredTools.map((t) => (
                  <div key={t.name} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="font-mono text-[11.5px] font-bold text-[var(--ink)]">{t.name}</span>
                    <span className="flex-1 truncate text-[11px] text-[var(--dim)]">{t.description}</span>
                    <Badge tone={t.permission === 'admin' ? 'rust' : t.permission === 'write' ? 'amber' : 'slate'}>{t.permission}</Badge>
                  </div>
                ))}
                {tab === 'resources' && filteredResources.length === 0 && (
                  <div className="p-6 text-center font-mono text-[11px] text-[var(--faint)]">
                    {searchQuery ? 'No resources match your filter.' : 'No resources available.'}
                  </div>
                )}
                {tab === 'resources' && filteredResources.map((r) => (
                  <div key={r.uri} className="px-4 py-2.5">
                    <div className="font-mono text-[11px] font-bold text-[var(--teal)]">{r.uri}</div>
                    <div className="text-[10.5px] text-[var(--dim)]">{r.description}</div>
                  </div>
                ))}
                {tab === 'prompts' && filteredPrompts.length === 0 && (
                  <div className="p-6 text-center font-mono text-[11px] text-[var(--faint)]">
                    {searchQuery ? 'No prompts match your filter.' : 'No prompts available.'}
                  </div>
                )}
                {tab === 'prompts' && filteredPrompts.map((p) => (
                  <div key={p.name} className="px-4 py-2.5">
                    <div className="font-mono text-[11px] font-bold text-[var(--plum)]">{p.name}</div>
                    <div className="text-[10.5px] text-[var(--dim)]">{p.description}</div>
                  </div>
                ))}
              </Card>
            </div>

            {/* Tokens sidebar — sticky */}
            <div className="sticky top-4 self-start">
            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] font-extrabold uppercase tracking-wide text-[var(--dim)]">Capability Tokens</span>
                <Button variant="primary" size="sm" onClick={() => setShowIssue(true)}>Issue</Button>
              </div>
              <div className="space-y-2">
                {data.tokens.length === 0 ? (
                  <div className="py-4 text-center font-mono text-[10px] text-[var(--faint)]">No active tokens.</div>
                ) : data.tokens.map((tok) => {
                  const scopes = safeParseScopes(tok.scopes_json);
                  return (
                    <div key={tok.id} className="rounded-[9px] border border-[var(--line)] bg-[var(--paper)] p-2">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--olive)]" />
                        <span className="font-mono text-[11px] font-bold text-[var(--ink)]">{tok.client}</span>
                        <button
                          className="ml-auto font-mono text-[10px] text-[var(--faint)] hover:text-[var(--rust)] disabled:opacity-50"
                          onClick={() => setConfirmRevoke(tok.id)}
                          disabled={busyRevoke === tok.id}
                        >
                          {busyRevoke === tok.id ? '\u2026' : 'revoke'}
                        </button>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {scopes.map((s) => <Badge key={s} tone="slate">{s}</Badge>)}
                      </div>
                      <div className="mt-1 font-mono text-[8.5px] text-[var(--faint)]">
                        expires {daysAgo(tok.expires_at)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            </div>
          </div>
        </>
      )}

      {/* Issue Token Modal */}
      {showIssue && (
        <Modal title="Issue Token" onClose={() => setShowIssue(false)}>
          <div className="space-y-3">
            <div>
              <label className="block font-mono text-[10px] text-[var(--faint)] mb-1">Client</label>
              <input
                value={newClient}
                onChange={(e) => setNewClient(e.target.value)}
                placeholder="e.g. my-app"
                className="w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-[var(--faint)] mb-1">Scopes (comma separated)</label>
              <input
                value={newScopes}
                onChange={(e) => setNewScopes(e.target.value)}
                placeholder="memory.read,memory.write"
                className="w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="primary" size="sm" onClick={() => void handleIssue()} disabled={issuing || !newClient.trim()}>
                {issuing ? '\u2026' : 'Issue Token'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowIssue(false)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Revoke Confirmation ───────────────────────────────────────────── */}
      {confirmRevoke && (
        <Modal title="Confirm Revoke" onClose={() => setConfirmRevoke(null)}>
          <div className="font-mono text-[11px] text-[var(--dim)] mb-4">
            Are you sure you want to revoke this token? This action cannot be undone.
          </div>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={() => void handleRevoke(confirmRevoke)} disabled={busyRevoke === confirmRevoke}>
              {busyRevoke === confirmRevoke ? '\u2026' : 'Revoke'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmRevoke(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
