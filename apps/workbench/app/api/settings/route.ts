// SPDX-License-Identifier: Apache-2.0

import { getSettings } from '@/lib/demo-store';
export const dynamic = 'force-dynamic';

// Canonical 5-layer config precedence from @orqenix/core config/loader.ts:
// defaults < global < custom < project < env (later layers win).
const LAYERS = ['defaults', 'global', 'custom', 'project', 'env'] as const;
type Layer = (typeof LAYERS)[number];

const MODULE_CONTRACTS: Array<{
  moduleId: string; phase: number; crVersion: string; hotReloadable: boolean;
  hierarchyOverride: string; defaults: Record<string, unknown>;
}> = [
  { moduleId: '@orqenix/memory', phase: 5, crVersion: 'v8.0', hotReloadable: true, hierarchyOverride: 'project', defaults: { memoryTier: 'T2', injectionStrategy: 'C', maxTokensPerLevel: 4096, enableHierarchy: true } },
  { moduleId: '@orqenix/storage', phase: 5, crVersion: 'v8.0', hotReloadable: false, hierarchyOverride: 'project', defaults: { kbPath: '~/.orqenix/kb', vectorDim: 384, enableWAL: true, syncInterval: 300 } },
  { moduleId: '@orqenix/search', phase: 5, crVersion: 'v8.0', hotReloadable: true, hierarchyOverride: 'branch', defaults: { algorithm: 'semantic', topK: 10, minScore: 0.65, rerankEnabled: true } },
  { moduleId: '@orqenix/mesh', phase: 6, crVersion: 'v8.0', hotReloadable: true, hierarchyOverride: 'project', defaults: { discoveryMode: 'mdns', autoReconnect: true, maxPeers: 16, heartbeatMs: 15000 } },
  { moduleId: '@orqenix/cloud-sync', phase: 6, crVersion: 'v8.0', hotReloadable: false, hierarchyOverride: 'project', defaults: { enabled: false, provider: 's3', interval: 3600, encrypt: true } },
  { moduleId: '@orqenix/self-learning', phase: 8, crVersion: 'v8.0', hotReloadable: true, hierarchyOverride: 'project', defaults: { observerEnabled: true, minOccurrences: 5, minSuccessRate: 0.8, cooldownHours: 24 } },
  { moduleId: '@orqenix/plugins', phase: 8, crVersion: 'v8.0', hotReloadable: true, hierarchyOverride: 'project', defaults: { sandboxMode: 'process', allowUnsigned: false, maxMemoryMb: 256, logLevel: 'info' } },
];

// In-memory override store for demo purposes
const overrides: Record<string, Record<string, unknown>> = {};

// Deterministic pseudo-source per key: ~1/2 of settings are pre-set at a
// non-default layer so the source-layer story is visible on first load.
function seedLayer(moduleId: string, key: string): Layer {
  let h = 0;
  const s = moduleId + ':' + key;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const pick = h % 4; // 0..3 → global, custom, project, env (never 'defaults')
  return LAYERS[pick + 1] as Layer;
}

export async function GET(): Promise<Response> {
  const groups = MODULE_CONTRACTS.map((mod) => {
    const moduleOverrides = overrides[mod.moduleId] ?? {};
    return {
      moduleId: mod.moduleId,
      phase: mod.phase,
      crVersion: mod.crVersion,
      hotReloadable: mod.hotReloadable,
      hierarchyOverride: mod.hierarchyOverride,
      settings: Object.entries(mod.defaults).map(([key, defaultValue]) => {
        const userOverridden = key in moduleOverrides;
        // Layer that currently wins: an explicit user override is at the
        // 'project' layer; otherwise the seeded source layer (or 'defaults').
        const sourceLayer: Layer = userOverridden ? 'project' : seedLayer(mod.moduleId, key);
        const overrideLayers: Layer[] = LAYERS.filter((l) => {
          if (l === 'defaults') return false;
          if (userOverridden) return l === 'project';
          return l === seedLayer(mod.moduleId, key);
        });
        const currentVal = userOverridden ? moduleOverrides[key] : defaultValue;
        return {
          key,
          default: defaultValue,
          value: currentVal,
          overridden: userOverridden || sourceLayer !== 'defaults',
          sourceLayer,
          overrideLayers,
        };
      }),
    };
  });
  return Response.json({ groups });
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string; moduleId?: unknown; key?: unknown; value?: unknown;
  };
  if (typeof body.moduleId !== 'string' || typeof body.key !== 'string') {
    return Response.json({ error: 'moduleId and key required as strings' }, { status: 400 });
  }
  const mod = MODULE_CONTRACTS.find((m) => m.moduleId === body.moduleId);
  if (!mod) return Response.json({ error: 'module not found' }, { status: 404 });
  if (!(body.key in mod.defaults)) return Response.json({ error: 'unknown key' }, { status: 404 });

  if (body.action === 'update') {
    if (!overrides[body.moduleId]) overrides[body.moduleId] = {};
    overrides[body.moduleId]![body.key] = body.value;
    return Response.json({ ok: true, moduleId: body.moduleId, key: body.key, value: body.value });
  }
  if (body.action === 'reset') {
    if (overrides[body.moduleId]) delete overrides[body.moduleId]![body.key];
    return Response.json({ ok: true, moduleId: body.moduleId, key: body.key, reset: true });
  }
  return Response.json({ error: 'unknown action' }, { status: 400 });
}
