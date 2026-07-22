// SPDX-License-Identifier: Apache-2.0
// Workbench , Engine initialization (production wiring)
//
// Initializes all @orqenix/* engine instances needed by API routes and backs
// every subsystem with the live MemoryEngine SQLite DB. demo-store remains
// ONLY a graceful fallback when the engine cannot open. Each subsystem reports
// its status via getEngineStatus(); ORQENIX_STRICT=1 makes init failures fatal.

import { SettingsRegistry, InMemorySettingsPersistence } from '@orqenix/settings-registry';
import { MemoryEngine } from '@orqenix/memory-engine';
import type { KbKind, MemoryEntry } from '@orqenix/memory-engine';
import { bootstrapSettings } from './settings-bootstrap';
import {
  getSessions, startSession, resumeSession, pauseSession, abortSession,
  promoteSessionMemory, getBranches,
} from '@/lib/demo-store';
import type { Session } from '@/lib/demo-store';
import { join } from 'node:path';
import type { Database } from 'better-sqlite3';

// ── Phase 4: self-learning ───────────────────────────────────────────────
import { PromoterService } from '@orqenix/instinct-promoter';
import { Observer, BasicPiiFilter } from '@orqenix/self-learning-observer';
import { BasicDetector } from '@orqenix/self-learning-detection';
import { SkillGenesis } from '@orqenix/skill-genesis';
import { MigrationRunner, ALL_PHASE_8_CORE_MIGRATIONS } from '@orqenix/memory-engine';
import { SELF_LEARNING_MIGRATIONS } from '@orqenix/self-learning-observer';
import { MEMORY_LINK_MIGRATIONS } from './migrations/570-memory-links';
import { AGENT_MIGRATIONS } from './migrations/580-agents';
import { WORKBENCH_STATE_MIGRATIONS } from './migrations/590-workbench-state';

// ── Phase 4: marketplace + plugins ───────────────────────────────────────
import { MarketplaceManager, RegistryResolverRegistry } from '@orqenix/marketplace-core';
import type { MarketplaceAuditWriter } from '@orqenix/marketplace-core';
import { NormalizationEngine } from '@orqenix/normalization-engine';
import {
  PluginRegistry, PluginLifecycle, NoopPluginAuditWriter,
} from '@orqenix/plugin-core';
import { ALL_INPUT_ADAPTERS } from '@orqenix/input-adapters';
import { ALL_OUTPUT_ADAPTERS } from '@orqenix/output-adapters';
import { SqliteLocalPluginStore } from './marketplace-store';
import { SqlitePluginPersistence } from './stores/plugin-persistence';
import { WorkbenchMarketplaceAuditWriter } from './audit/marketplace-audit';
import {
  createSessionRow, listSessions, resumeSessionRow, pauseSessionRow,
  abortSessionRow, promoteSessionRow, PROJECT_ID,
} from './stores/session-store';

// ── Types ─────────────────────────────────────────────────────────────────

export interface SettingEntry {
  key: string;
  default: unknown;
  value: unknown;
  overridden: boolean;
  sourceLayer: string;
  overrideLayers: string[];
}

export interface SettingsGroup {
  moduleId: string;
  phase: number;
  crVersion: string;
  hotReloadable: boolean;
  hierarchyOverride: string;
  settings: SettingEntry[];
}

export interface MemoryQueryResult {
  id: string;
  kb: string;
  tier: string;
  content: string | null;
  branch_id: string;
  session_id: string | null;
  memory_level: string;
  created_at: string;
  score: number;
  sourceLevel: string;
}

export type Subsystem =
  | 'settings' | 'memory' | 'sessions' | 'branches'
  | 'promoter' | 'observer' | 'marketplace' | 'plugins' | 'skills';
export type SubsystemStatus = 'real' | 'demo';

// ── Global singleton ──────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __orqenixSettings: SettingsRegistry | undefined;
  // eslint-disable-next-line no-var
  var __orqenixMemory: MemoryEngine | undefined;
  // eslint-disable-next-line no-var
  var __orqenixPromoter: PromoterService | undefined;
  // eslint-disable-next-line no-var
  var __orqenixObserver: Observer | undefined;
  // eslint-disable-next-line no-var
  var __orqenixDetector: BasicDetector | undefined;
  // eslint-disable-next-line no-var
  var __orqenixSkillGenesis: SkillGenesis | undefined;
  // eslint-disable-next-line no-var
  var __orqenixMarketplace: MarketplaceManager | undefined;
  // eslint-disable-next-line no-var
  var __orqenixPluginRegistry: PluginRegistry | undefined;
  // eslint-disable-next-line no-var
  var __orqenixPluginLifecycle: PluginLifecycle | undefined;
  // eslint-disable-next-line no-var
  var __orqenixInitPromise: Promise<void> | undefined;
}

const engineStatus: Record<Subsystem, SubsystemStatus> = {
  settings: 'real',
  memory: 'real',
  sessions: 'real',
  branches: 'real',
  promoter: 'real',
  observer: 'real',
  marketplace: 'real',
  plugins: 'real',
  skills: 'real',
};

// Single source of truth for strict mode. Env strings are truthy even when "0",
// so compare explicitly (README/M8: 0 = demo fallback, 1/true = fail loud).
export const STRICT =
  process.env.ORQENIX_STRICT === '1' || process.env.ORQENIX_STRICT === 'true';

// Workbench-owned side tables (created at init; engine tables are package-owned).
const SIDE_TABLES_DDL = `
CREATE TABLE IF NOT EXISTS workbench_session_meta (
  session_id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  progress REAL DEFAULT 0,
  promoted_entries INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS workbench_plugin_meta (
  name TEXT PRIMARY KEY,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  author TEXT DEFAULT 'local'
);
CREATE TABLE IF NOT EXISTS workbench_plugin_config (
  name TEXT PRIMARY KEY,
  config_json TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS workbench_skill_state (
  name TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS workbench_skill_invocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  invoked_at TEXT NOT NULL,
  prompt TEXT DEFAULT '',
  output TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS workbench_observer_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER DEFAULT 1,
  pii_filter_enabled INTEGER DEFAULT 1,
  notify_on_first_launch INTEGER DEFAULT 1,
  sample_rate REAL DEFAULT 1.0
);
CREATE TABLE IF NOT EXISTS marketplace_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  kind TEXT NOT NULL,
  actor TEXT NOT NULL,
  project_id TEXT NOT NULL,
  payload_json TEXT DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS mcp_tokens (
  id TEXT PRIMARY KEY,
  client TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

// Idempotent side-table creation + bootstrap seeds (shared by init() and runtime.construct()).
export function seedWorkbench(db: Database, projectId: string): void {
  db.exec(SIDE_TABLES_DDL);
  db.prepare(
    `INSERT OR IGNORE INTO workbench_observer_config (id, enabled, pii_filter_enabled, notify_on_first_launch, sample_rate)
     VALUES (1, 1, 1, 1, 1.0)`,
  ).run();
  db.prepare(
    `INSERT OR IGNORE INTO branches (branch_id, project_id, branch_name, created_at, cloned_from_branch_id, cell_snapshot)
     VALUES (?, ?, 'main', ?, NULL, '{}')`,
  ).run('blake3:main0000000000aabb', projectId, new Date().toISOString());
}

// ═══════════════════════════════════════════════════════════════════════════
// SIDE-TABLE ACCESSORS (sync, on the raw DB)
// ═══════════════════════════════════════════════════════════════════════════

export function readPluginMeta(db: Database, name: string): { description: string; category: string; author: string } {
  const row = db
    .prepare(`SELECT description, category, author FROM workbench_plugin_meta WHERE name=?`)
    .get(name) as { description?: string; category?: string; author?: string } | undefined;
  return { description: row?.description ?? '', category: row?.category ?? 'general', author: row?.author ?? 'local' };
}

export function writePluginMeta(
  db: Database, name: string,
  m: { description?: string; category?: string; author?: string },
): void {
  const cur = readPluginMeta(db, name);
  const next = {
    description: m.description ?? cur.description,
    category: m.category ?? cur.category,
    author: m.author ?? cur.author,
  };
  db.prepare(
    `INSERT INTO workbench_plugin_meta (name, description, category, author)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET description=excluded.description, category=excluded.category, author=excluded.author`,
  ).run(name, next.description, next.category, next.author);
}

export function readPluginConfig(db: Database, name: string): string {
  const row = db.prepare(`SELECT config_json FROM workbench_plugin_config WHERE name=?`).get(name) as
    | { config_json?: string }
    | undefined;
  return row?.config_json ?? '';
}

export function writePluginConfig(db: Database, name: string, config: string): void {
  db.prepare(
    `INSERT INTO workbench_plugin_config (name, config_json) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET config_json=excluded.config_json`,
  ).run(name, config);
}

export function readSkillState(db: Database, name: string): boolean {
  const row = db.prepare(`SELECT enabled FROM workbench_skill_state WHERE name=?`).get(name) as
    | { enabled?: number }
    | undefined;
  return row ? !!row.enabled : true;
}

export function writeSkillState(db: Database, name: string, enabled: boolean, category?: string): void {
  if (category !== undefined) {
    const cur = readPluginMeta(db, name);
    writePluginMeta(db, name, { category: category || cur.category });
  }
  db.prepare(
    `INSERT INTO workbench_skill_state (name, enabled) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET enabled=excluded.enabled`,
  ).run(name, enabled ? 1 : 0);
}

// Shape mappers + installLocalPlugin moved to lib/engine/plugins.ts, lib/engine/skills.ts, lib/engine/marketplace.ts

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export async function getAllSettingsGroups(): Promise<SettingsGroup[]> {
  const registry = await getSettings();
  const contracts = registry.listContracts();
  const groups: SettingsGroup[] = [];

  for (const contract of contracts) {
    const overrides = await registry.getPersistence().listByModule(contract.moduleId);
    const settings: SettingEntry[] = [];

    for (const [key, defaultValue] of Object.entries(contract.defaults)) {
      const resolved = await registry.resolve(contract.moduleId, key);
      const relevantOverrides = overrides.filter((o) => o.settingPath === key);
      const overrideLayers: string[] = relevantOverrides.map((o) => o.level);
      const sourceLayer = resolved.source === 'built-in-default'
        ? overrideLayers.length > 0 ? overrideLayers[overrideLayers.length - 1]! : 'defaults'
        : resolved.source;

      settings.push({
        key,
        default: defaultValue,
        value: resolved.value,
        overridden: resolved.source !== 'built-in-default',
        sourceLayer,
        overrideLayers,
      });
    }

    groups.push({
      moduleId: contract.moduleId,
      phase: contract.provenance.phase,
      crVersion: contract.provenance.crVersion,
      hotReloadable: contract.hotReloadable,
      hierarchyOverride: contract.hierarchyOverride,
      settings,
    });
  }

  return groups;
}

export async function updateSetting(moduleId: string, key: string, value: unknown): Promise<void> {
  const registry = await getSettings();
  await registry.update(moduleId, key, value, {
    level: 'project',
    hierarchyId: 'workbench-project',
    setBy: 'workbench-user',
  });
}

export async function revertSetting(moduleId: string, key: string): Promise<void> {
  const registry = await getSettings();
  await registry.revert(moduleId, key, {
    level: 'project',
    hierarchyId: 'workbench-project',
    setBy: 'workbench-user',
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export async function queryMemory(
  limit: number,
  filters: { tier?: string; kb?: string; branchId?: string; memoryLevel?: string } = {},
): Promise<MemoryQueryResult[]> {
  const engine = await getMemory();
  if (!engine) {
    const { queryEntries } = await import('@/lib/demo-store');
    const entries = queryEntries(limit, filters as Parameters<typeof queryEntries>[1]);
    return entries.map((e) => ({
      id: e.id, kb: e.kb, tier: e.tier, content: e.content,
      branch_id: e.branch_id, session_id: e.session_id,
      memory_level: e.memory_level, created_at: e.created_at,
      score: 1, sourceLevel: e.memory_level ?? 'project',
    }));
  }
  try {
    const branchId = filters.branchId ?? 'default-branch';
    const result = await engine.query({
      query: '', branchId, limit,
      kbs: filters.kb ? [filters.kb as KbKind] : undefined,
      minRelevanceScore: 0,
    });
    return result.results.map((r) => ({
      id: r.entry.id, kb: r.entry.kb, tier: r.entry.tier,
      content: r.entry.content, branch_id: r.entry.branch_id,
      session_id: r.entry.session_id, memory_level: r.entry.memory_level,
      created_at: r.entry.created_at, score: r.finalScore,
      sourceLevel: r.sourceLevel,
    }));
  } catch (err) {
    console.error('[queryMemory]', err);
    return [];
  }
}

export async function getMemoryEntry(id: string): Promise<MemoryEntry | null> {
  const engine = await getMemory();
  if (!engine) {
    const { getEntry } = await import('@/lib/demo-store');
    return (getEntry(id) as MemoryEntry | null) ?? null;
  }
  const store = engine.getStore();
  const kbs: KbKind[] = ['chat', 'code', 'decision', 'lesson'];
  for (const kb of kbs) {
    const entry = store.getEntry(kb, id);
    if (entry) return entry;
  }
  return null;
}

export async function promoteMemoryEntry(
  entryId: string, targetBranchId: string, kb: KbKind
): Promise<{ newId: string } | null> {
  const engine = await getMemory();
  if (!engine) {
    const { promoteToBranch } = await import('@/lib/demo-store');
    return promoteToBranch(entryId, targetBranchId) as { newId: string } | null;
  }
  try {
    await engine.promote({
      entryId, kb, from: 'session', to: 'branch', fromBranchId: targetBranchId,
    });
    return { newId: entryId + '-promoted' };
  } catch (err) {
    console.error('[promoteMemoryEntry]', err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION HELPERS (real SQLite; demo fallback)
// ═══════════════════════════════════════════════════════════════════════════

export function getAllSessions(): Session[] {
  const db = getDb();
  if (!db) return getSessions();
  return listSessions(db);
}
export function createSession(agentName: string, agentPlatform: string, parentSessionId?: string): Session {
  const db = getDb();
  if (!db) return startSession(agentName, agentPlatform, parentSessionId);
  return createSessionRow(db, agentName, agentPlatform, parentSessionId);
}
export function resumeExistingSession(id: string): boolean {
  const db = getDb();
  return db ? resumeSessionRow(db, id) : resumeSession(id);
}
export function pauseExistingSession(id: string): boolean {
  const db = getDb();
  return db ? pauseSessionRow(db, id) : pauseSession(id);
}
export function abortExistingSession(id: string): boolean {
  const db = getDb();
  return db ? abortSessionRow(db, id) : abortSession(id);
}
export function promoteSession(id: string): number {
  const db = getDb();
  return db ? promoteSessionRow(db, id) : (promoteSessionMemory(id) ?? 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// BRANCH HELPERS (real BranchStore.listBranches)
// ═══════════════════════════════════════════════════════════════════════════

export interface BranchResult {
  branchId: string;
  branchName: string;
  created_at: string;
  cloned_from_branch_id: string | null;
  sessions: number;
}

export async function getAllBranches(): Promise<BranchResult[]> {
  const engine = await getMemory();
  if (!engine) {
    const branches = getBranches();
    return branches.map((b) => ({
      branchId: b.branch_id,
      branchName: b.branch_name,
      created_at: b.created_at,
      cloned_from_branch_id: b.cloned_from_branch_id,
      sessions: b.sessions,
    }));
  }
  const branches = engine.getBranchStore().listBranches(PROJECT_ID);
  const db = engine.getStore().db;
  return branches.map((b) => ({
    branchId: b.branchId,
    branchName: b.branchName,
    created_at: b.createdAt,
    cloned_from_branch_id: b.clonedFromBranchId,
    sessions: (db.prepare('SELECT COUNT(*) AS c FROM sessions WHERE branch_id=?').get(b.branchId) as { c: number }).c,
  }));
}

export async function createBranchFromParent(
  parentBranchId: string, newBranchName: string
): Promise<BranchResult | null> {
  const engine = await getMemory();
  if (engine) {
    try {
      const result = await engine.createBranch({
        parentBranchId,
        newBranchName,
        cloneTiers: 'all',
      });
      return {
        branchId: result.branchId,
        branchName: result.branchName,
        created_at: new Date().toISOString(),
        cloned_from_branch_id: parentBranchId,
        sessions: 0,
      };
    } catch (err) {
      console.error('[initDashboard] engine error, falling back to demo:', err);
    }
  }
  const { createBranch } = await import('@/lib/demo-store');
  const result = createBranch(parentBranchId, newBranchName);
  if (!result) return null;
  return {
    branchId: result.branchId,
    branchName: newBranchName,
    created_at: new Date().toISOString(),
    cloned_from_branch_id: parentBranchId,
    sessions: 0,
  };
}

// Self-learning helpers moved to lib/engine/learning.ts

// Marketplace helpers moved to lib/engine/marketplace.ts

// Plugin helpers moved to lib/engine/plugins.ts

// MCP token helpers moved to lib/engine/mcp.ts

// Skill helpers moved to lib/engine/skills.ts

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

async function init(): Promise<void> {
  // 1. Settings Registry — always available (in-memory persistence)
  const settings = new SettingsRegistry({ persistence: new InMemorySettingsPersistence() });
  await bootstrapSettings(settings);
  globalThis.__orqenixSettings = settings;
  engineStatus.settings = 'real';

  // 2. Memory Engine + all dependent subsystems (each guarded independently)
  const dbPath = process.env.ORQENIX_DB ?? join(process.cwd(), '.orqenix', 'memory.db');
  try {
    const engine = await MemoryEngine.open(dbPath, {
      projectId: PROJECT_ID,
      bootstrapBaseTables: true,
      failOnDrift: process.env.NODE_ENV === 'production' || process.env.ORQENIX_STRICT === '1',
    });
    globalThis.__orqenixMemory = engine;
    const db = engine.getStore().db;
    engineStatus.memory = 'real';

    // Run all workbench migrations on top of core engine migrations
    const runner = new MigrationRunner(db);
    const allMigrations = [
      ...ALL_PHASE_8_CORE_MIGRATIONS,
      ...SELF_LEARNING_MIGRATIONS,
      ...MEMORY_LINK_MIGRATIONS,
      ...AGENT_MIGRATIONS,
      ...WORKBENCH_STATE_MIGRATIONS,
    ].sort((a, b) => a.id - b.id);
    runner.apply(allMigrations, false);

    // Workbench-owned side tables + bootstrap seeds (idempotent)
    seedWorkbench(db, PROJECT_ID);

    // 3. Observer + Detector (self-learning observability)
    try {
      globalThis.__orqenixObserver = new Observer({ db, piiFilter: new BasicPiiFilter() });
      engineStatus.observer = 'real';
    } catch (e) {
      engineStatus.observer = 'demo';
      if (STRICT) throw e;
    }

    // 4. Detector + SkillGenesis
    let detector: BasicDetector | undefined;
    try {
      detector = new BasicDetector({ db });
      globalThis.__orqenixDetector = detector;
      engineStatus.skills = 'real';
    } catch (e) {
      engineStatus.skills = 'demo';
      if (STRICT) throw e;
    }
    try {
      globalThis.__orqenixSkillGenesis = new SkillGenesis({
        db,
        observer: globalThis.__orqenixObserver ?? new Observer({ db, piiFilter: new BasicPiiFilter() }),
        candidateStore: detector?.getCandidateStore(),
      });
      engineStatus.skills = 'real';
    } catch (e) {
      engineStatus.skills = 'demo';
      if (STRICT) throw e;
    }

    // 5. PromoterService
    try {
      globalThis.__orqenixPromoter = new PromoterService({
        db,
        candidateStore: detector?.getCandidateStore(),
        observer: globalThis.__orqenixObserver!,
        skillGenesis: globalThis.__orqenixSkillGenesis!,
        audit: engine.getAuditWriter() as never,
      });
      engineStatus.promoter = 'real';
    } catch (e) {
      engineStatus.promoter = 'demo';
      if (STRICT) throw e;
    }

    // 6. Plugins — shared registry + lifecycle (used by both plugin routes and marketplace)
    try {
      const persistence = new SqlitePluginPersistence(db);
      const registry = new PluginRegistry(persistence);
      await registry.init();
      globalThis.__orqenixPluginRegistry = registry;
      globalThis.__orqenixPluginLifecycle = new PluginLifecycle({
        registry,
        auditWriter: new NoopPluginAuditWriter(),
      });
      engineStatus.plugins = 'real';
    } catch (e) {
      engineStatus.plugins = 'demo';
      if (STRICT) throw e;
    }

    // 7. Marketplace
    try {
      const store = new SqliteLocalPluginStore(engine);
      const audit: MarketplaceAuditWriter = new WorkbenchMarketplaceAuditWriter(db);
      const normalization = new NormalizationEngine({
        inputAdapters: ALL_INPUT_ADAPTERS,
        outputAdapters: ALL_OUTPUT_ADAPTERS,
      });
      globalThis.__orqenixMarketplace = new MarketplaceManager({
        store,
        audit,
        normalizationEngine: normalization,
        lifecycle: globalThis.__orqenixPluginLifecycle ?? new PluginLifecycle(),
        resolverRegistry: new RegistryResolverRegistry(),
        actor: 'workbench-user',
        projectId: PROJECT_ID,
      });
      engineStatus.marketplace = 'real';
    } catch (e) {
      engineStatus.marketplace = 'demo';
      if (STRICT) throw e;
    }

    // 8. Sessions + branches follow the live engine
    engineStatus.sessions = 'real';
    engineStatus.branches = 'real';
  } catch (err) {
    const sysErr = err as Error & { code?: string };
    const code = sysErr.code;
    if (code === 'EACCES') {
      console.error('[engine-init] PERMISSION DENIED: Cannot open database at', dbPath, '— check file permissions');
      if (STRICT) throw err;
    } else if (code === 'ENOENT') {
      console.warn('[engine-init] No .orqenix/ directory found — first launch. Falling back to demo mode. Run `orqenix init` to initialize persistent storage.');
      // ENOENT is expected on first launch — never fatal even under STRICT
    } else {
      console.error('[engine-init] MemoryEngine init failed, using demo-store fallback:', sysErr.message);
      if (STRICT) throw err;
    }
    engineStatus.memory = 'demo';
    engineStatus.sessions = 'demo';
    engineStatus.branches = 'demo';
    engineStatus.observer = 'demo';
    engineStatus.skills = 'demo';
    engineStatus.promoter = 'demo';
    engineStatus.plugins = 'demo';
    engineStatus.marketplace = 'demo';
  }
}

export function ensureInit(): Promise<void> {
  if (globalThis.__orqenixSettings) return Promise.resolve();
  if (!globalThis.__orqenixInitPromise) {
    globalThis.__orqenixInitPromise = init();
  }
  return globalThis.__orqenixInitPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ACCESSORS
// ═══════════════════════════════════════════════════════════════════════════

export function getEngineStatus(): Record<Subsystem, SubsystemStatus> {
  return { ...engineStatus };
}

export function getDb(): Database | null {
  const e = globalThis.__orqenixMemory;
  return e ? e.getStore().db : null;
}

export function getLocalStore(): SqliteLocalPluginStore | null {
  const e = globalThis.__orqenixMemory;
  return e ? new SqliteLocalPluginStore(e) : null;
}

export async function getSettings(): Promise<SettingsRegistry> {
  await ensureInit();
  if (!globalThis.__orqenixSettings) {
    const s = new SettingsRegistry({ persistence: new InMemorySettingsPersistence() });
    await bootstrapSettings(s);
    globalThis.__orqenixSettings = s;
    return s;
  }
  return globalThis.__orqenixSettings;
}

export async function getMemory(): Promise<MemoryEngine | null> {
  await ensureInit();
  return globalThis.__orqenixMemory ?? null;
}

/** Sync accessors — only call after ensureInit */
export function getPromoterSync(): PromoterService | null { return globalThis.__orqenixPromoter ?? null; }
export function getSkillGenesisSync(): SkillGenesis | null { return globalThis.__orqenixSkillGenesis ?? null; }
export function getPluginRegistrySync(): PluginRegistry | null { return globalThis.__orqenixPluginRegistry ?? null; }
export function getObserverSync(): Observer | null { return globalThis.__orqenixObserver ?? null; }
export function getDetectorSync(): BasicDetector | null { return globalThis.__orqenixDetector ?? null; }
export function getMarketplaceSync(): MarketplaceManager | null { return globalThis.__orqenixMarketplace ?? null; }

// Re-exports from domain modules for backward compat
export { issueMcpToken, listMcpTokens, revokeMcpToken } from './engine/mcp';
export type { McpToken } from './engine/mcp';
export {
  getAllPlugins, getPluginById, createPluginItem, updatePluginItem,
  deletePluginItem, togglePluginItem, getPluginConfig, updatePluginConfig,
} from './engine/plugins';
export {
  getAllSkills, createSkillItem, updateSkillItem, deleteSkillItem,
  toggleSkillItem, invokeSkill,
} from './engine/skills';
export type { SkillInvocationResult } from './engine/skills';
export {
  getLearningCandidates, reviewCandidate, getObserverConfigData,
  setObserverConfigData, getVerificationCandidates, generateSkillFromCandidate,
} from './engine/learning';
export type { LearningCandidateResult } from './engine/learning';
export {
  getMarketplaceItems, marketplaceInstall, marketplaceUninstall,
  ALL_MARKETPLACE_KINDS,
} from './engine/marketplace';
