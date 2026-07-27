// SPDX-License-Identifier: Apache-2.0
// Phase 6: Setting interface includes sourceLayer + overrideLayers,
//          5-layer source visibility badge in the UI.

'use client';

import * as React from 'react';
import { Card, Badge, Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';

// ── Canonical 5-layer config precedence ───────────────────────────────────
const LAYERS = ['defaults', 'global', 'custom', 'project', 'env'] as const;
type Layer = (typeof LAYERS)[number];

const LAYER_COLORS: Record<Layer, string> = {
  defaults: 'var(--stone)',
  global: 'var(--blue)',
  custom: 'var(--olive)',
  project: 'var(--rust)',
  env: 'var(--amber)',
};

interface Setting {
  key: string;
  default: unknown;
  value: unknown;
  overridden: boolean;
  sourceLayer: Layer | string;
  overrideLayers: (Layer | string)[];
}

interface Group {
  moduleId: string;
  phase: number;
  crVersion: string;
  hotReloadable: boolean;
  hierarchyOverride: string;
  settings: Setting[];
}

// ── 5-layer source visibility badge ──────────────────────────────────────

function LayerBadge({ layer, active }: { layer: Layer; active: boolean }) {
  return (
    <span
      title={active ? `Value provided by ${layer} layer` : `${layer} layer — no override`}
      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold leading-none transition-all"
      style={{
        background: active ? LAYER_COLORS[layer] : 'var(--line2)',
        color: active ? '#fff' : 'var(--faint)',
        opacity: active ? 1 : 0.35,
      }}
    >
      {layer === 'defaults' ? 'D' : layer === 'global' ? 'G' : layer === 'custom' ? 'C' : layer === 'project' ? 'P' : 'E'}
    </span>
  );
}

function LayerIndicator({ sourceLayer, overrideLayers }: { sourceLayer: Layer | string; overrideLayers: (Layer | string)[] }) {
  const activeLayer = (LAYERS.includes(sourceLayer as Layer) ? sourceLayer : 'defaults') as Layer;
  const activeSet = new Set(overrideLayers.length > 0 ? overrideLayers : [activeLayer]);

  return (
    <div className="flex items-center gap-[3px]" title={`Source: ${sourceLayer} | Overrides: ${overrideLayers.join(', ') || 'none'}`}>
      {LAYERS.map((layer) => (
        <LayerBadge key={layer} layer={layer} active={activeSet.has(layer) || layer === activeLayer} />
      ))}
    </div>
  );
}

// ── Setting editor ───────────────────────────────────────────────────────

function SettingEditor({
  setting,
  edits,
  onEdit,
  busy,
  onSave,
  onReset,
}: {
  setting: Setting;
  edits: Record<string, unknown>;
  busy: string | null;
  onEdit: (key: string, value: unknown) => void;
  onSave: (s: Setting) => void;
  onReset: (s: Setting) => void;
}) {
  const cur = setting.key in edits ? edits[setting.key] : setting.value;

  let editor: React.ReactNode;
  if (typeof setting.default === 'boolean') {
    editor = (
      <button
        onClick={() => onEdit(setting.key, !cur)}
        className="relative h-4 w-7 shrink-0 rounded-full transition-colors"
        style={{ background: cur ? 'var(--rust)' : 'var(--line2)' }}
      >
        <span
          className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all"
          style={{ left: cur ? 14 : 2 }}
        />
      </button>
    );
  } else if (typeof setting.default === 'number') {
    editor = (
      <input
        type="number"
        value={String(cur)}
        onChange={(e) => onEdit(setting.key, e.target.value)}
        className="w-28 shrink-0 rounded-[7px] border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-right font-mono text-[11px] outline-none focus:border-[var(--rust)]"
      />
    );
  } else {
    editor = (
      <input
        value={String(cur)}
        onChange={(e) => onEdit(setting.key, e.target.value)}
        className="w-40 shrink-0 rounded-[7px] border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-right font-mono text-[11px] outline-none focus:border-[var(--rust)]"
      />
    );
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <LayerIndicator sourceLayer={setting.sourceLayer} overrideLayers={setting.overrideLayers} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 font-mono text-[11.5px] text-[var(--ink)]">
          <span className="truncate">{setting.key}</span>
          {setting.overridden && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--amber)]" title={`override at ${setting.sourceLayer}`} />
          )}
        </div>
        <div className="font-mono text-[9.5px] text-[var(--faint)]">
          {setting.sourceLayer !== 'defaults'
            ? `${setting.sourceLayer} › ${JSON.stringify(setting.value)}`
            : `default: ${JSON.stringify(setting.default)}`}
        </div>
      </div>
      {editor}
      <Button variant="primary" size="sm" onClick={() => onSave(setting)} disabled={busy === setting.key}>
        {busy === setting.key ? '\u2026' : 'Save'}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onReset(setting)} disabled={!setting.overridden || busy === setting.key}>
        Reset
      </Button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export function SettingsModulePage({ moduleId }: { moduleId: string }) {
  const { toast } = useToast();
  const [group, setGroup] = React.useState<Group | null>(null);
  const [edits, setEdits] = React.useState<Record<string, unknown>>({});
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      const res = await api.get<{ groups: Group[] }>('/api/settings');
      if (res.ok) {
        const found = res.data!.groups.find((g) => g.moduleId === moduleId);
        if (found) setGroup(found);
      }
    }
    void load();
  }, [moduleId]);

  function handleEdit(key: string, value: unknown) {
    setEdits((e) => ({ ...e, [key]: value }));
  }

  async function handleSave(s: Setting) {
    if (!group) return;
    const newVal = s.key in edits ? edits[s.key] : s.value;
    setBusy(s.key);
    const res = await api.post('/api/settings', {
      action: 'update',
      moduleId: group.moduleId,
      key: s.key,
      value: newVal,
    });
    setBusy(null);
    if (res.ok) {
      toast({ title: 'Saved', message: `${s.key} updated`, tone: 'success' });
      const r2 = await api.get<{ groups: Group[] }>('/api/settings');
      if (r2.ok) {
        const found = r2.data!.groups.find((g) => g.moduleId === moduleId);
        if (found) setGroup(found);
      }
    } else {
      toast({ title: 'Failed', message: res.error ?? 'unknown', tone: 'error' });
    }
  }

  async function handleReset(s: Setting) {
    if (!group) return;
    setBusy(s.key);
    const res = await api.post('/api/settings', {
      action: 'reset',
      moduleId: group.moduleId,
      key: s.key,
    });
    setBusy(null);
    if (res.ok) {
      toast({ title: 'Reset', message: `${s.key} returned to default`, tone: 'info' });
      const r2 = await api.get<{ groups: Group[] }>('/api/settings');
      if (r2.ok) {
        const found = r2.data!.groups.find((g) => g.moduleId === moduleId);
        if (found) setGroup(found);
      }
    } else {
      toast({ title: 'Failed', message: res.error ?? 'unknown', tone: 'error' });
    }
  }

  if (!group) {
    return (
      <Card className="p-10 text-center font-mono text-[11px] text-[var(--faint)]">
        Loading&hellip;
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-serif text-[18px] font-semibold text-[var(--ink)]">
          {group.moduleId.replace('@orqenix/', '')}
        </span>
        <Badge tone="amber">Phase {group.phase} &middot; {group.crVersion}</Badge>
        {group.hotReloadable && <Badge tone="olive">hot-reloadable</Badge>}
        <Badge tone="neutral">{group.hierarchyOverride}</Badge>
      </div>

      {/* Layer legend */}
      <div className="mb-3 flex items-center gap-3 font-mono text-[9px] text-[var(--faint)]">
        {LAYERS.map((layer) => (
          <span key={layer} className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: LAYER_COLORS[layer] }}
            />
            {layer}
          </span>
        ))}
      </div>

      <div className="divide-y divide-[var(--line)]">
        {group.settings.map((s) => (
          <SettingEditor
            key={s.key}
            setting={s}
            edits={edits}
            busy={busy}
            onEdit={handleEdit}
            onSave={handleSave}
            onReset={handleReset}
          />
        ))}
      </div>
    </Card>
  );
}
