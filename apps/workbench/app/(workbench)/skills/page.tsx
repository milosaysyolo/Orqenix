'use client';

import * as React from 'react';
import { SectionTitle, Card, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { ConfigEditor } from '@/components/config-editor';
import { Modal } from '@/components/modal';
import { api } from '@/lib/api';
import { useLiveEvents } from '@/lib/use-live-events';

interface Skill {
  id: string; name: string; category: string; version: string;
  enabled: boolean; description: string; config?: string;
}

type SortKey = 'name' | 'version' | 'enabled';

export default function SkillsPage() {
  const { toast } = useToast();
  const [skills, setSkills] = React.useState<Skill[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('all');
  const [sortKey, setSortKey] = React.useState<SortKey>('name');
  const [busyToggle, setBusyToggle] = React.useState<string | null>(null);
  const [busyInvoke, setBusyInvoke] = React.useState<string | null>(null);
  const [invokeId, setInvokeId] = React.useState<string | null>(null);
  const [invokePrompt, setInvokePrompt] = React.useState('');

  // CRUD state
  const [showForm, setShowForm] = React.useState(false);
  const [editSkill, setEditSkill] = React.useState<Skill | null>(null);
  const [formName, setFormName] = React.useState('');
  const [formCategory, setFormCategory] = React.useState('');
  const [formVersion, setFormVersion] = React.useState('');
  const [formDescription, setFormDescription] = React.useState('');
  const [busyCrud, setBusyCrud] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);

  // Config editor state
  const [configSkillId, setConfigSkillId] = React.useState<string | null>(null);
  const [configContent, setConfigContent] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await api.get<{ skills: Skill[] }>('/api/skills');
    if (res.ok) setSkills(res.data!.skills);
    setLoading(false);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  // Live events
  const { latest: liveEvent } = useLiveEvents(['learning.candidate']);
  React.useEffect(() => {
    if (liveEvent) void load();
  }, [liveEvent, load]);

  async function handleToggle(id: string) {
    setBusyToggle(id);
    const res = await api.post(`/api/skills/${id}/toggle`);
    setBusyToggle(null);
    if (res.ok) {
      setSkills((prev) => prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s));
      toast({ tone: 'success', title: 'Toggled', message: `skill ${id} updated` });
    } else {
      toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' });
    }
  }

  async function handleInvoke(id: string) {
    const skill = skills.find((s) => s.id === id);
    if (!skill || !invokePrompt.trim()) return;
    setBusyInvoke(id);
    const res = await api.post<{ ok: boolean; output: string; durationMs: number }>(`/api/skills/${id}/invoke`, { prompt: invokePrompt.trim() });
    setBusyInvoke(null);
    if (res.ok && res.data) {
      toast({ tone: 'success', title: skill.name, message: res.data.output.slice(0, 80) });
    } else {
      toast({ tone: 'error', title: 'Invoke failed', message: res.error ?? 'unknown' });
    }
    setInvokeId(null);
    setInvokePrompt('');
  }

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  function openNew() {
    setEditSkill(null);
    setFormName(''); setFormCategory(''); setFormVersion('1.0.0'); setFormDescription('');
    setShowForm(true);
  }

  function openEdit(s: Skill) {
    setEditSkill(s);
    setFormName(s.name); setFormCategory(s.category); setFormVersion(s.version); setFormDescription(s.description);
    setShowForm(true);
  }

  async function saveSkill() {
    if (!formName.trim()) { toast({ tone: 'error', title: 'Validation', message: 'Name is required' }); return; }
    setBusyCrud(true);
    if (editSkill) {
      const res = await api.put(`/api/skills/${editSkill.id}`, {
        name: formName.trim(), category: formCategory.trim() || 'general',
        version: formVersion.trim() || '1.0.0', description: formDescription.trim(),
      });
      if (res.ok) {
        setSkills((prev) => prev.map((s) => s.id === editSkill.id ? { ...s, name: formName.trim(), category: formCategory.trim() || 'general', version: formVersion.trim() || '1.0.0', description: formDescription.trim() } : s));
        toast({ tone: 'success', title: 'Updated', message: `Skill ${formName.trim()}` });
        setShowForm(false);
      } else {
        toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' });
      }
    } else {
      const res = await api.post<{ skill: Skill }>('/api/skills', {
        name: formName.trim(), category: formCategory.trim() || 'general',
        version: formVersion.trim() || '1.0.0', enabled: true, description: formDescription.trim(),
      });
      if (res.ok && res.data) {
        setSkills((prev) => [...prev, res.data!.skill]);
        toast({ tone: 'success', title: 'Created', message: `Skill ${formName.trim()}` });
        setShowForm(false);
      } else {
        toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' });
      }
    }
    setBusyCrud(false);
  }

  async function deleteSkill(id: string) {
    setBusyCrud(true);
    const res = await api.del(`/api/skills/${id}`);
    setBusyCrud(false);
    if (res.ok) {
      setSkills((prev) => prev.filter((s) => s.id !== id));
      toast({ tone: 'info', title: 'Deleted', message: 'Skill removed' });
      setDeleteConfirm(null);
    } else {
      toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' });
    }
  }

  const categories = React.useMemo(() => {
    const cats = new Set(skills.map((s) => s.category));
    return Array.from(cats).sort();
  }, [skills]);

  const filtered = React.useMemo(() => {
    let list = skills;
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'all') {
      list = list.filter((s) => s.category === categoryFilter);
    }
    list = [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'version') return b.version.localeCompare(a.version);
      return Number(b.enabled) - Number(a.enabled);
    });
    return list;
  }, [skills, query, categoryFilter, sortKey]);

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <div className="flex items-center justify-between">
        <SectionTitle sub="Reusable agent capabilities and learned patterns">Skills</SectionTitle>
        <Button variant="primary" size="sm" onClick={openNew}>+ New Skill</Button>
      </div>

      {/* Search + Filter + Sort bar */}
      <div className="mt-4 flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-[var(--faint)]">{'\u2315'}</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills&hellip;"
            className="w-full rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-8 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-[9px] border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
        >
          <option value="name">Name</option>
          <option value="version">Version</option>
          <option value="enabled">Enabled</option>
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
          {query || categoryFilter !== 'all'
            ? 'No skills match your search. Try a different filter.'
            : 'No skills installed. Promote a pattern in Learning Hub or install from Marketplace.'}
        </Card>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((s) => (
            <Card key={s.id} className="flex items-center gap-3 px-4 py-3">
              <span className="font-mono text-[16px] text-[var(--amber)]">{'\u2726'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[12px] font-bold text-[var(--ink)]">{s.name}</span>
                  <Badge tone="neutral">v{s.version}</Badge>
                  <Badge tone={s.enabled ? 'olive' : 'neutral'}>{s.enabled ? 'enabled' : 'disabled'}</Badge>
                  <Badge tone="slate">{s.category}</Badge>
                </div>
                <p className="text-[11px] text-[var(--dim)] truncate">{s.description}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {invokeId === s.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={invokePrompt}
                      onChange={(e) => setInvokePrompt(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleInvoke(s.id); if (e.key === 'Escape') { setInvokeId(null); setInvokePrompt(''); } }}
                      placeholder="Enter prompt&hellip;"
                      autoFocus
                      className="w-[140px] rounded-[6px] border border-[var(--line)] bg-[var(--paper)] px-2 py-1 font-mono text-[10px] text-[var(--ink)] outline-none focus:border-[var(--rust)]"
                    />
                    <Button variant="primary" size="sm" onClick={() => void handleInvoke(s.id)} disabled={busyInvoke === s.id}>
                      {busyInvoke === s.id ? '\u2026' : 'Go'}
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => { setInvokeId(s.id); setInvokePrompt(''); }}>{'>'} Invoke</Button>
                    <button onClick={() => { setConfigSkillId(s.id);           setConfigContent(s.config ?? ''); }}
                      className="rounded-[6px] border border-[var(--teal)] px-2 py-1 font-mono text-[9px] text-[var(--teal)] hover:bg-[color-mix(in_oklab,var(--teal)_8%,transparent)]">
                      Config
                    </button>
                    <button onClick={() => openEdit(s)}
                      className="rounded-[6px] border border-[var(--line)] px-2 py-1 font-mono text-[9px] text-[var(--dim)] hover:text-[var(--ink)]">
                      Edit
                    </button>
                    <button onClick={() => setDeleteConfirm(s.id)}
                      className="rounded-[6px] border border-[var(--rust)] px-2 py-1 font-mono text-[9px] text-[var(--rust)]">
                      Del
                    </button>
                  </>
                )}
                <button
                  onClick={() => void handleToggle(s.id)}
                  disabled={busyToggle === s.id}
                  className={`rounded-[6px] border px-2 py-1 font-mono text-[9.5px] transition-colors ${
                    s.enabled
                      ? 'border-[var(--rust)] text-[var(--rust)] hover:bg-[color-mix(in_oklab,var(--rust)_8%,transparent)]'
                      : 'border-[var(--line)] text-[var(--faint)] hover:border-[var(--olive)] hover:text-[var(--olive)]'
                  }`}
                >
                  {busyToggle === s.id ? '\u2026' : s.enabled ? 'disable' : 'enable'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Skill Form Modal ──────────────────────────────────────────────── */}
      {showForm && (
        <Modal title={editSkill ? 'Edit Skill' : 'New Skill'} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="font-mono text-[10px] text-[var(--faint)]">Name</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)}
                className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-[var(--faint)]">Category</label>
              <input value={formCategory} onChange={(e) => setFormCategory(e.target.value)}
                placeholder="e.g. development, security, documentation"
                className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-[var(--faint)]">Version</label>
              <input value={formVersion} onChange={(e) => setFormVersion(e.target.value)}
                className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)]" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-[var(--faint)]">Description</label>
              <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3}
                className="mt-1 w-full rounded-[7px] border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 font-mono text-[12px] text-[var(--ink)] outline-none focus:border-[var(--rust)] resize-none" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="primary" size="sm" onClick={() => void saveSkill()} disabled={busyCrud}>
                {busyCrud ? '\u2026' : editSkill ? 'Save Changes' : 'Create Skill'}
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
            Are you sure you want to delete this skill?
          </div>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={() => void deleteSkill(deleteConfirm)} disabled={busyCrud}>
              {busyCrud ? '\u2026' : 'Delete'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          </div>
        </Modal>
      )}

      {/* ── Config Editor Modal ──────────────────────────────────────────── */}
      {configSkillId && (
        <Modal title={`Config — ${skills.find((s) => s.id === configSkillId)?.name ?? ''}`} onClose={() => setConfigSkillId(null)}>
          <div className="space-y-3">
            <ConfigEditor
              value={configContent}
              onChange={setConfigContent}
              language="markdown"
              height={350}
            />
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={async () => {
                const res = await api.put(`/api/skills/${configSkillId}/config`, { config: configContent });
                if (res.ok) {
                  setSkills((prev) => prev.map((s) => s.id === configSkillId ? { ...s, config: configContent } : s));
                  toast({ tone: 'success', title: 'Config saved', message: 'Skill config updated' });
                  setConfigSkillId(null);
                } else {
                  toast({ tone: 'error', title: 'Failed', message: res.error ?? 'unknown' });
                }
              }}>Save</Button>
              <Button variant="outline" size="sm" onClick={() => setConfigSkillId(null)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
