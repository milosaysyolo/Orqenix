// SPDX-License-Identifier: Apache-2.0

"use client";

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { useLiveEvents } from '@/lib/use-live-events';
import { api } from '@/lib/api';
import { Modal } from '@/components/modal';
import type { Session } from '@/lib/demo-store';

const STATE_TONE: Record<string, 'olive' | 'amber' | 'plum' | 'slate' | 'rust'> = {
  running: 'olive', idle: 'plum', paused: 'amber', completed: 'slate', error: 'rust',
};

const PLATFORMS = ['claude-code', 'cursor', 'codex', 'cline', 'continue', 'aider', 'opencode'];

export default function SessionsPage() {
  const { toast } = useToast();
  const { connected, latest } = useLiveEvents(['session.updated']);
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [filter, setFilter] = React.useState<string>('all');
  const [showStart, setShowStart] = React.useState(false);
  const [newAgent, setNewAgent] = React.useState('claude-code');
  const [newPlatform, setNewPlatform] = React.useState('claude-code');
  const [newParent, setNewParent] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await api.get<{ sessions: Session[] }>('/api/sessions');
    if (res.ok && res.data) setSessions(res.data.sessions);
  }, []);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => { if (latest) void load(); }, [latest, load]);

  const filtered = filter === 'all' ? sessions : sessions.filter((s) => s.state === filter);

  async function startSession() {
    if (!newAgent.trim()) { toast({ tone: 'error', title: 'Validation', message: 'Agent name required' }); return; }
    setBusy(true);
    const res = await api.post<{ ok: boolean }>('/api/sessions', { action: 'start', agentName: newAgent.trim(), agentPlatform: newPlatform, parentSessionId: newParent || undefined });
    setBusy(false);
    if (res.ok) { toast({ tone: 'success', title: 'Session started', message: `${newAgent.trim()} via ${newPlatform}` }); setShowStart(false); setNewAgent(''); void load(); }
    else toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' });
  }

  async function resumeSession(s: Session) {
    const res = await api.post<{ ok: boolean }>('/api/sessions', { action: 'resume', id: s.session_id });
    if (res.ok && res.data?.ok) { toast({ tone: 'success', title: 'Resumed', message: s.agent_name }); void load(); }
    else toast({ tone: 'error', title: 'Failed', message: res.error ?? 'cannot resume' });
  }

  async function pauseSession(s: Session) {
    const res = await api.post<{ ok: boolean }>('/api/sessions', { action: 'pause', id: s.session_id });
    if (res.ok && res.data?.ok) { toast({ tone: 'info', title: 'Paused', message: s.agent_name }); void load(); }
    else toast({ tone: 'error', title: 'Failed', message: res.error ?? 'cannot pause' });
  }

  async function abortSession(s: Session) {
    const res = await api.post<{ ok: boolean }>('/api/sessions', { action: 'abort', id: s.session_id });
    if (res.ok && res.data?.ok) { toast({ tone: 'success', title: 'Aborted', message: s.agent_name }); void load(); }
    else toast({ tone: 'error', title: 'Failed', message: res.error ?? 'cannot abort' });
  }

  async function promoteMemory(s: Session) {
    const res = await api.post<{ ok: boolean; promoted: number }>('/api/sessions', { action: 'promote', id: s.session_id });
    if (res.ok) { toast({ tone: 'success', title: 'Memory promoted', message: `${res.data?.promoted ?? 0} entries → branch` }); void load(); }
    else toast({ tone: 'error', title: 'Failed', message: res.error ?? 'cannot promote' });
  }

  const counts = {
    all: sessions.length,
    running: sessions.filter((s) => s.state === 'running').length,
    paused: sessions.filter((s) => s.state === 'paused').length,
    completed: sessions.filter((s) => s.state === 'completed').length,
    idle: sessions.filter((s) => s.state === 'idle').length,
  };

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <div className="flex items-start justify-between">
        <SectionTitle sub="Track and control agent sessions (orqenix_report_session_*)">Sessions</SectionTitle>
        <div className="flex items-center gap-2">
          <Badge tone={connected ? 'olive' : 'neutral'}>{connected ? 'live' : 'offline'}</Badge>
          <Button size="sm" variant="primary" onClick={() => setShowStart(true)}>+ Start Session</Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {(['all', 'running', 'paused', 'idle', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={'rounded-[7px] px-3 py-1 font-mono text-[11px] font-semibold capitalize transition-colors ' +
              (filter === f ? 'bg-[var(--rust)] text-[var(--paper)]' : 'text-[var(--dim)] hover:text-[var(--ink)]')}
          >{f} <span className="ml-0.5 opacity-70">({counts[f] ?? 0})</span></button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.length === 0 && (
          <Card className="grid min-h-[200px] place-items-center">
            <div className="text-center font-mono text-[11px] text-[var(--faint)]">no sessions match filter</div>
          </Card>
        )}
        {filtered.map((s) => (
          <Card key={s.session_id} className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
              <span className="font-mono text-[13px] font-bold text-[var(--ink)]">{s.agent_name}</span>
              <Badge tone={STATE_TONE[s.state] ?? 'neutral'}>{s.state}</Badge>
              <Badge tone="plum">{s.agent_platform}</Badge>
              {s.parent_session_id && <span className="font-mono text-[9px] text-[var(--faint)]">child of {s.parent_session_id}</span>}
              {s.promoted_entries ? <Badge tone="teal">↑{s.promoted_entries}</Badge> : null}
              <span className="font-mono text-[10px] text-[var(--faint)]">{s.session_id}</span>
              <span className="ml-auto font-mono text-[10px] text-[var(--faint)]">{new Date(s.started_at).toLocaleTimeString()}</span>
            </div>
            <div className="px-4 py-3">
              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-[var(--dim)]">progress</span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--paper2)]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round(s.progress * 100)}%`,
                      background: s.state === 'running' ? 'var(--olive)' : s.state === 'error' ? 'var(--rust)' : 'var(--slate)',
                    }}
                  />
                </div>
                <span className="font-mono text-[10px] font-bold text-[var(--dim)]">{Math.round(s.progress * 100)}%</span>
              </div>

              {/* Nested subagents */}
              {s.subagents && s.subagents.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <div className="font-mono text-[9.5px] font-extrabold uppercase text-[var(--faint)]">subagents</div>
                  {s.subagents.map((sub) => (
                    <div key={sub.session_id} className="flex items-center gap-2 rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5">
                      <span className="font-mono text-[11px] font-bold text-[var(--plum)]">{sub.agent_name}</span>
                      <Badge tone={STATE_TONE[sub.state] ?? 'neutral'}>{sub.state}</Badge>
                      <div className="ml-auto flex-1 h-1 rounded-full bg-[var(--paper2)]">
                        <div className="h-full rounded-full bg-[var(--plum)]" style={{ width: `${Math.round(sub.progress * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="mt-3 flex gap-2">
                {s.state === 'paused' && (
                  <Button size="sm" variant="outline" onClick={() => void resumeSession(s)}>resume</Button>
                )}
                {s.state === 'running' && (
                  <Button size="sm" variant="outline" onClick={() => void pauseSession(s)}>pause</Button>
                )}
                {s.state !== 'completed' && s.state !== 'error' && (
                  <Button size="sm" variant="outline" onClick={() => void promoteMemory(s)}>promote memory</Button>
                )}
                {s.state !== 'completed' && s.state !== 'error' && (
                  <Button size="sm" variant="danger" onClick={() => void abortSession(s)}>abort</Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {showStart && (
        <Modal title="Start New Session" onClose={() => setShowStart(false)}>
          <div className="space-y-3">
            <div>
              <label className="font-mono text-[10px] text-[var(--faint)]">Agent name</label>
              <input value={newAgent} onChange={(e) => setNewAgent(e.target.value)} placeholder="e.g. lead, researcher"
                className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-[var(--faint)]">Agent platform</label>
              <select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)}
                className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none">
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] text-[var(--faint)]">Parent session (optional)</label>
              <select value={newParent} onChange={(e) => setNewParent(e.target.value)}
                className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none">
                <option value="">none</option>
                {sessions.filter((x) => x.state !== 'completed').map((x) => <option key={x.session_id} value={x.session_id}>{x.agent_name} ({x.session_id})</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => void startSession()} disabled={busy}>{busy ? '…' : 'Start Session'}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowStart(false)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
