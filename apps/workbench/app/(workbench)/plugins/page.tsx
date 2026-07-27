'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { ConfigEditor } from '@/components/config-editor';
import { Modal } from '@/components/modal';
import { api } from '@/lib/api';
import { useLiveEvents } from '@/lib/use-live-events';

interface Plugin {
  id: string; name: string; version: string; enabled: boolean;
  description: string; author: string; config?: string;
}

export default function PluginsPage() {
  const { toast } = useToast();
  const [plugins, setPlugins] = React.useState<Plugin[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState('');
  const [filterEnabled, setFilterEnabled] = React.useState<'all' | 'enabled' | 'disabled'>('all');
  const [busy, setBusy] = React.useState<string | null>(null);

  // CRUD state
  const [showForm, setShowForm] = React.useState(false);
  const [editPlugin, setEditPlugin] = React.useState<Plugin | null>(null);
  const [formName, setFormName] = React.useState('');
  const [formVersion, setFormVersion] = React.useState('');
  const [formDescription, setFormDescription] = React.useState('');
  const [formAuthor, setFormAuthor] = React.useState('');
  const [busyCrud, setBusyCrud] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);

  // Config editor state
  const [configPluginId, setConfigPluginId] = React.useState<string | null>(null);
  const [configContent, setConfigContent] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await api.get<{ plugins: Plugin[] }>('/api/plugins');
    if (res.ok) setPlugins(res.data!.plugins);
    setLoading(false);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  // Live events
  const { latest: liveEvent } = useLiveEvents(['session.updated']);
  React.useEffect(() => {
    if (liveEvent) void load();
  }, [liveEvent, load]);

  async function handleToggle(id: string) {
    setBusy(id);
    const res = await api.post(`/api/plugins/${id}/toggle`);
    setBusy(null);
    if (res.ok) {
      setPlugins((prev) => prev.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p));
      toast({ tone: 'success', title: 'Toggled', message: `plugin ${id} updated` });
    } else {
      toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' });
    }
  }

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  function openNew() {
    setEditPlugin(null);
    setFormName(''); setFormVersion('1.0.0'); setFormDescription(''); setFormAuthor('');
    setShowForm(true);
  }

  function openEdit(p: Plugin) {
    setEditPlugin(p);
    setFormName(p.name); setFormVersion(p.version); setFormDescription(p.description); setFormAuthor(p.author);
    setShowForm(true);
  }

  async function savePlugin() {
    if (!formName.trim()) { toast({ tone: 'error', title: 'Validation', message: 'Name is required' }); return; }
    setBusyCrud(true);
    if (editPlugin) {
      const res = await api.put(`/api/plugins/${editPlugin.id}`, {
        name: formName.trim(), version: formVersion.trim() || '1.0.0',
        description: formDescription.trim(), author: formAuthor.trim() || 'user',
      });
      if (res.ok) {
        setPlugins((prev) => prev.map((p) => p.id === editPlugin.id ? { ...p, name: formName.trim(), version: formVersion.trim() || '1.0.0', description: formDescription.trim(), author: formAuthor.trim() || 'user' } : p));
        toast({ tone: 'success', title: 'Updated', message: `Plugin ${formName.trim()}` });
        setShowForm(false);
      } else {
        toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' });
      }
    } else {
      const res = await api.post<{ plugin: Plugin }>('/api/plugins', {
        name: formName.trim(), version: formVersion.trim() || '1.0.0',
        enabled: true, description: formDescription.trim(), author: formAuthor.trim() || 'user',
      });
      if (res.ok && res.data) {
        setPlugins((prev) => [...prev, res.data!.plugin]);
        toast({ tone: 'success', title: 'Created', message: `Plugin ${formName.trim()}` });
        setShowForm(false);
      } else {
        toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' });
      }
    }
    setBusyCrud(false);
  }

  async function deletePlugin(id: string) {
    setBusyCrud(true);
    const res = await api.del(`/api/plugins/${id}`);
    setBusyCrud(false);
    if (res.ok) {
      setPlugins((prev) => prev.filter((p) => p.id !== id));
      toast({ tone: 'info', title: 'Deleted', message: 'Plugin removed' });
      setDeleteConfirm(null);
    } else {
      toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' });
    }
  }

  const filtered = React.useMemo(() => {
    let list = plugins;
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (filterEnabled === 'enabled') list = list.filter((p) => p.enabled);
    else if (filterEnabled === 'disabled') list = list.filter((p) => !p.enabled);
    return list;
  }, [plugins, query, filterEnabled]);

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <div className="flex items-center justify-between">
        <SectionTitle sub="Manage installed plugins across your workspace">Plugins</SectionTitle>
        <Button variant="primary" size="sm" onClick={openNew}>+ New Plugin</Button>
      </div>

      {/* Search + Filter bar */}
      <div className="mt-4 flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-[var(--faint)]">{'\u2315'}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plugins&hellip;"
            className="w-full rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-8 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
          />
        </div>
        <select
          value={filterEnabled}
          onChange={(e) => setFilterEnabled(e.target.value as 'all' | 'enabled' | 'disabled')}
          className="rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
        >
          <option value="all">All</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
              <div className="h-4 w-4 rounded-full bg-[var(--line)]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 rounded bg-[var(--line)]" />
                <div className="h-2.5 w-64 rounded bg-[var(--line)]" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="mt-4 p-10 text-center font-mono text-[11px] text-[var(--faint)]">
          {query || filterEnabled !== 'all'
            ? 'No plugins match your search.'
            : 'No plugins installed. Visit the Marketplace to install.'}
        </Card>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((p) => (
            <Card key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="font-mono text-[15px] text-[var(--teal)]">{'\u25A3'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{p.name}</span>
                  <Badge tone="neutral">v{p.version}</Badge>
                  <Badge tone={p.enabled ? 'olive' : 'neutral'}>{p.enabled ? 'enabled' : 'disabled'}</Badge>
                </div>
                <p className="text-[11px] text-[var(--dim)] truncate">{p.description}</p>
                <span className="font-mono text-[9.5px] text-[var(--faint)]">{p.author}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => { setConfigPluginId(p.id); setConfigContent(p.config ?? ''); }}
                  className="rounded-[6px] border border-[var(--teal)] px-2 py-1 font-mono text-[9px] text-[var(--teal)] hover:bg-[color-mix(in_oklab,var(--teal)_8%,transparent)]">
                  Config
                </button>
                <button onClick={() => openEdit(p)}
                  className="rounded-[6px] border border-[var(--line)] px-2 py-1 font-mono text-[9px] text-[var(--dim)] hover:text-[var(--ink)]">
                  Edit
                </button>
                <button onClick={() => setDeleteConfirm(p.id)}
                  className="rounded-[6px] border border-[var(--rust)] px-2 py-1 font-mono text-[9px] text-[var(--rust)]">
                  Del
                </button>
                <button
                  onClick={() => void handleToggle(p.id)}
                  disabled={busy === p.id}
                  className={`rounded-[6px] border px-2.5 py-1 font-mono text-[9.5px] transition-colors ${
                    p.enabled
                      ? 'border-[var(--rust)] text-[var(--rust)] hover:bg-[color-mix(in_oklab,var(--rust)_8%,transparent)]'
                      : 'border-[var(--line)] text-[var(--faint)] hover:border-[var(--olive)] hover:text-[var(--olive)]'
                  }`}
                >
                  {busy === p.id ? '\u2026' : p.enabled ? 'disable' : 'enable'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Plugin Form Modal ─────────────────────────────────────────────── */}
      {showForm && (
        <Modal title={editPlugin ? 'Edit Plugin' : 'New Plugin'} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="font-mono text-[10px] text-[var(--faint)]">Name</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)}
                className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-[var(--faint)]">Version</label>
              <input value={formVersion} onChange={(e) => setFormVersion(e.target.value)}
                className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-[var(--faint)]">Author</label>
              <input value={formAuthor} onChange={(e) => setFormAuthor(e.target.value)}
                className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-[var(--faint)]">Description</label>
              <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3}
                className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)] resize-none" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="primary" size="sm" onClick={() => void savePlugin()} disabled={busyCrud}>
                {busyCrud ? '\u2026' : editPlugin ? 'Save Changes' : 'Create Plugin'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirmation ───────────────────────────────────────────── */}
      {deleteConfirm && (
        <Modal title="Confirm Delete" onClose={() => setDeleteConfirm(null)}>
          <div className="font-mono text-[11px] text-[var(--dim)] mb-4">
            Are you sure you want to delete this plugin?
          </div>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={() => void deletePlugin(deleteConfirm)} disabled={busyCrud}>
              {busyCrud ? '\u2026' : 'Delete'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          </div>
        </Modal>
      )}

      {/* ── Config Editor Modal ──────────────────────────────────────────── */}
      {configPluginId && (
        <Modal title={`Config — ${plugins.find((p) => p.id === configPluginId)?.name ?? ''}`} onClose={() => setConfigPluginId(null)}>
          <div className="space-y-3">
            <ConfigEditor
              value={configContent}
              onChange={setConfigContent}
              language="json"
              height={350}
            />
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={async () => {
                const res = await api.put(`/api/plugins/${configPluginId}/config`, { config: configContent });
                if (res.ok) {
                  setPlugins((prev) => prev.map((p) => p.id === configPluginId ? { ...p, config: configContent } : p));
                  toast({ tone: 'success', title: 'Config saved', message: 'Plugin config updated' });
                  setConfigPluginId(null);
                } else {
                  toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' });
                }
              }}>Save</Button>
              <Button variant="outline" size="sm" onClick={() => setConfigPluginId(null)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
