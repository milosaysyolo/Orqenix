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
  promoteSessionMemory, getBranches, getPlugins, getSkills, getMarketplace,
  getObserverConfig, setObserverConfig, createPlugin, updatePlugin, deletePlugin,
  togglePlugin, createSkill, updateSkill, deleteSkill, toggleSkill,
  toggleInstall, syncMarketplaceInstall, syncMarketplaceUninstall,
} from '@/lib/demo-store';
import type { Session, MarketplaceItem, Plugin, Skill } from '@/lib/demo-store';
import { join } from 'node:path';
import type { Database } from 'better-sqlite3';

// ── Phase 4: self-learning ───────────────────────────────────────────────
import { PromoterService } from '@orqenix/instinct-promoter';
import type { ReviewDecision, PromoterCandidate } from '@orqenix/instinct-promoter';
import { Observer, BasicPiiFilter } from '@orqenix/self-learning-observer';
import type { ObserverConfig } from '@orqenix/self-learning-observer';
import { BasicDetector } from '@orqenix/self-learning-detection';
import { SkillGenesis } from '@orqenix/skill-genesis';
import { MigrationRunner, ALL_PHASE_8_CORE_MIGRATIONS } from '@orqenix/memory-engine';
import { SELF_LEARNING_MIGRATIONS } from '@orqenix/self-learning-observer';
import { MEMORY_LINK_MIGRATIONS } from './migrations/570-memory-links';
import { AGENT_MIGRATIONS } from './migrations/580-agents';
import { WORKBENCH_STATE_MIGRATIONS } from './migrations/590-workbench-state';

// ── Phase 4: marketplace + plugins ───────────────────────────────────────
import { MarketplaceManager, RegistryResolverRegistry, MarketplaceCrud } from '@orqenix/marketplace-core';
import type { MarketplaceAuditWriter } from '@orqenix/marketplace-core';
import { NormalizationEngine } from '@orqenix/normalization-engine';
import {
  PluginRegistry, PluginLifecycle, NoopPluginAuditWriter,
  type PluginDiscoveryResult, type RegisteredPlugin, type CanonicalSkillFormat,
  type PluginKind,
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
  memory: 'demo',
  sessions: 'demo',
  branches: 'demo',
  promoter: 'demo',
  observer: 'demo',
  marketplace: 'demo',
  plugins: 'demo',
  skills: 'demo',
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

function readPluginMeta(db: Database, name: string): { description: string; category: string; author: string } {
  const row = db
    .prepare(`SELECT description, category, author FROM workbench_plugin_meta WHERE name=?`)
    .get(name) as { description?: string; category?: string; author?: string } | undefined;
  return { description: row?.description ?? '', category: row?.category ?? 'general', author: row?.author ?? 'local' };
}

function writePluginMeta(
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

function readPluginConfig(db: Database, name: string): string {
  const row = db.prepare(`SELECT config_json FROM workbench_plugin_config WHERE name=?`).get(name) as
    | { config_json?: string }
    | undefined;
  return row?.config_json ?? '';
}

function writePluginConfig(db: Database, name: string, config: string): void {
  db.prepare(
    `INSERT INTO workbench_plugin_config (name, config_json) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET config_json=excluded.config_json`,
  ).run(name, config);
}

function readSkillState(db: Database, name: string): boolean {
  const row = db.prepare(`SELECT enabled FROM workbench_skill_state WHERE name=?`).get(name) as
    | { enabled?: number }
    | undefined;
  return row ? !!row.enabled : true;
}

function writeSkillState(db: Database, name: string, enabled: boolean, category?: string): void {
  if (category !== undefined) {
    const cur = readPluginMeta(db, name);
    writePluginMeta(db, name, { category: category || cur.category });
  }
  db.prepare(
    `INSERT INTO workbench_skill_state (name, enabled) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET enabled=excluded.enabled`,
  ).run(name, enabled ? 1 : 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// SHAPE MAPPING (real entities -> UI contract shapes)
// ═══════════════════════════════════════════════════════════════════════════

function regToPlugin(db: Database, reg: RegisteredPlugin): Plugin {
  const csf = reg.csf;
  const meta = readPluginMeta(db, csf.name);
  return {
    id: csf.name,
    name: csf.name,
    version: csf.version,
    enabled: reg.state === 'active',
    description: meta.description || '',
    author: meta.author || csf.provenance.imported_from?.kind || 'local',
    config: readPluginConfig(db, csf.name),
  };
}

function csfToSkill(db: Database, csf: CanonicalSkillFormat): Skill {
  const meta = readPluginMeta(db, csf.name);
  return {
    id: csf.name,
    name: csf.name,
    category: meta.category || 'general',
    version: csf.version,
    enabled: readSkillState(db, csf.name),
    description: meta.description || '',
    config: readPluginConfig(db, csf.name),
  };
}

function csfToMarketplaceItem(db: Database, csf: CanonicalSkillFormat, installed: boolean): MarketplaceItem {
  const meta = readPluginMeta(db, csf.name);
  const author = meta.author || csf.provenance.imported_from?.kind || 'local';
  return {
    id: csf.name,
    name: csf.name,
    kind: csf.kind,
    description: meta.description || '',
    author,
    publisher: author,
    version: csf.version,
    downloads: 0,
    rating: 0,
    license: csf.manifest.license || 'MIT',
    source: 'local',
    verified: false,
    installed,
  };
}

function fallbackRegisteredPlugin(csf: CanonicalSkillFormat): RegisteredPlugin {
  const now = new Date().toISOString();
  return {
    csf,
    packagePath: csf.name,
    state: 'installed',
    installedAt: now,
    lastActivatedAt: null,
    crashCount: 0,
    totalInvocations: 0,
    totalErrors: 0,
  };
}

async function installLocalPlugin(name: string): Promise<boolean> {
  const reg = globalThis.__orqenixPluginRegistry;
  const engine = globalThis.__orqenixMemory;
  if (!reg || !engine) return false;
  const csf = await new SqliteLocalPluginStore(engine).get(name);
  if (!csf) return false;
  const discovery: PluginDiscoveryResult = {
    csf,
    packagePath: name,
    entryPath: '',
    isValidPlugin: true,
    issues: [],
  };
  try {
    await reg.register(discovery);
    await reg.setState(name, 'active');
    await reg.flush();
    return true;
  } catch {
    return false;
  }
}

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
  } catch {
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
  } catch {
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
    } catch {
      // fall through to demo-store
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

// ═══════════════════════════════════════════════════════════════════════════
// SELF-LEARNING HELPERS (real PromoterService + Observer + SkillGenesis)
// ═══════════════════════════════════════════════════════════════════════════

export interface LearningCandidateResult {
  id: string;
  patternName: string;
  patternDescription: string;
  occurrenceCount: number;
  successRate: number;
  impactScore: number;
  estTimeSavedPerWeekMin: number;
  status: string;
}

function enrichCandidate(c: PromoterCandidate): LearningCandidateResult {
  return {
    id: c.id,
    patternName: c.patternName,
    patternDescription: c.patternDescription,
    occurrenceCount: c.occurrenceCount,
    successRate: c.successRate,
    impactScore: c.impactScore,
    estTimeSavedPerWeekMin: c.estTimeSavedPerWeekMin,
    status: c.status,
  };
}

export async function getLearningCandidates(): Promise<LearningCandidateResult[]> {
  const promoter = getPromoterSync();
  if (promoter) {
    try {
      const candidates = await promoter.listForReview(PROJECT_ID);
      return candidates.map(enrichCandidate);
    } catch {
      // fall through
    }
  }
  const { getCandidates } = await import('@/lib/demo-store');
  return getCandidates().map((c) => ({
    id: c.id,
    patternName: c.name,
    patternDescription: `Pattern "${c.name}" observed ${c.count} times with ${Math.round(c.successRate * 100)}% success rate.`,
    occurrenceCount: c.count,
    successRate: c.successRate,
    impactScore: c.impact,
    estTimeSavedPerWeekMin: Math.round(c.impact * 30),
    status: c.status,
  }));
}

export async function reviewCandidate(
  candidateId: string, action: string
): Promise<{ ok: boolean; generatedSkillName?: string; openBuilder?: boolean }> {
  const promoter = getPromoterSync();
  if (promoter) {
    try {
      const decision: ReviewDecision = {
        candidateId,
        action: action as ReviewDecision['action'],
        reviewedBy: 'workbench-user',
      };
      const result = await promoter.review(decision, PROJECT_ID);
      return {
        ok: result.ok,
        generatedSkillName: result.generatedSkillName,
        openBuilder: result.openBuilder,
      };
    } catch {
      // fall through
    }
  }
  const { setCandidateStatus } = await import('@/lib/demo-store');
  const status = action === 'promote' || action === 'promote_customize' ? 'approved' : action === 'reject' ? 'rejected' : 'pending';
  const ok = setCandidateStatus(candidateId, status);
  if (!ok) return { ok: false };
  const result: { ok: boolean; generatedSkillName?: string; openBuilder?: boolean } = { ok: true };
  if (action === 'promote' || action === 'promote_customize') {
    result.generatedSkillName = `${candidateId}-skill`;
    if (action === 'promote_customize') result.openBuilder = true;
  }
  return result;
}

export async function getObserverConfigData(): Promise<ObserverConfig> {
  const db = getDb();
  if (!db) {
    const cfg = getObserverConfig();
    return { enabled: cfg.enabled, piiFilterEnabled: true, notifyOnFirstLaunch: true, sampleRate: 1.0 };
  }
  const row = db
    .prepare(`SELECT enabled, pii_filter_enabled, notify_on_first_launch, sample_rate FROM workbench_observer_config WHERE id=1`)
    .get() as { enabled?: number; pii_filter_enabled?: number; notify_on_first_launch?: number; sample_rate?: number } | undefined;
  if (!row) return { enabled: true, piiFilterEnabled: true, notifyOnFirstLaunch: true, sampleRate: 1.0 };
  return {
    enabled: !!row.enabled,
    piiFilterEnabled: !!row.pii_filter_enabled,
    notifyOnFirstLaunch: !!row.notify_on_first_launch,
    sampleRate: row.sample_rate ?? 1.0,
  };
}

export async function setObserverConfigData(config: Partial<ObserverConfig>): Promise<void> {
  const db = getDb();
  if (!db) {
    setObserverConfig(config.enabled ?? true);
    return;
  }
  db.prepare(
    `INSERT INTO workbench_observer_config (id, enabled, pii_filter_enabled, notify_on_first_launch, sample_rate)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       enabled=excluded.enabled, pii_filter_enabled=excluded.pii_filter_enabled,
       notify_on_first_launch=excluded.notify_on_first_launch, sample_rate=excluded.sample_rate`,
  ).run(config.enabled ? 1 : 0, config.piiFilterEnabled ? 1 : 0, config.notifyOnFirstLaunch ? 1 : 0, config.sampleRate ?? 1.0);
}

export async function getVerificationCandidates(): Promise<LearningCandidateResult[]> {
  const candidates = await getLearningCandidates();
  return candidates.filter((c) => c.status === 'approved' || c.status === 'promoted');
}

export async function generateSkillFromCandidate(
  candidateId: string, _language?: string, _nameOverride?: string
): Promise<{ ok: boolean; skillName?: string; verificationStatus: string }> {
  const genesis = getSkillGenesisSync();
  if (genesis) {
    try {
      const result = await genesis.generateFromCandidate({
        candidateId,
        projectId: PROJECT_ID,
      });
      return { ok: true, skillName: result.skillName, verificationStatus: 'unverified' };
    } catch {
      // fall through
    }
  }
  return { ok: true, verificationStatus: 'unverified' };
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKETPLACE HELPERS (real CSF catalog + registry install/uninstall)
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_MARKETPLACE_KINDS = [
  'knowledge-source', 'embedding-model', 'reranker', 'compression-strategy',
  'memory-injection-strategy', 'prompt-rewriter', 'visualization', 'code-analyzer',
  'kb-schema', 'mcp-server', 'agent', 'subagent', 'skill', 'agent-binding',
] as const;

export async function getMarketplaceItems(
  kind?: string, query?: string, tab?: string
): Promise<{ items: MarketplaceItem[]; kinds: readonly string[] }> {
  const db = getDb();
  const store = getLocalStore();
  const reg = getPluginRegistrySync();
  if (!db || !store) {
    let items = getMarketplace();
    if (tab === 'installed') items = items.filter((i) => i.installed);
    if (kind && kind !== 'all') items = items.filter((i) => i.kind === kind);
    if (query) {
      const q = query.toLowerCase();
      items = items.filter((i) =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.author.toLowerCase().includes(q));
    }
    return { items, kinds: ALL_MARKETPLACE_KINDS };
  }
  const csfs = await store.list();
  let items = csfs.map((csf) => csfToMarketplaceItem(db, csf, reg ? reg.find(csf.name) != null : false));
  if (tab === 'installed') items = items.filter((i) => i.installed);
  if (kind && kind !== 'all') items = items.filter((i) => i.kind === kind);
  if (query) {
    const q = query.toLowerCase();
    items = items.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.author.toLowerCase().includes(q));
  }
  return { items, kinds: ALL_MARKETPLACE_KINDS };
}

export async function marketplaceInstall(name: string): Promise<boolean> {
  const reg = getPluginRegistrySync();
  if (!reg) {
    toggleInstall(name);
    syncMarketplaceInstall(name);
    return true;
  }
  return installLocalPlugin(name);
}

export async function marketplaceUninstall(name: string): Promise<boolean> {
  const reg = getPluginRegistrySync();
  if (!reg) {
    toggleInstall(name);
    syncMarketplaceUninstall(name);
    return true;
  }
  try {
    await reg.unregister(name);
    await reg.flush();
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PLUGIN HELPERS (real PluginRegistry backed by installed_plugins)
// ═══════════════════════════════════════════════════════════════════════════

export async function getAllPlugins(): Promise<Plugin[]> {
  const reg = getPluginRegistrySync();
  const db = getDb();
  if (!reg || !db) return getPlugins();
  return reg.list().map((r) => regToPlugin(db, r));
}

export async function getPluginById(id: string): Promise<Plugin | null> {
  const reg = getPluginRegistrySync();
  const db = getDb();
  if (!reg || !db) return getPlugins().find((p) => p.id === id) ?? null;
  const r = reg.find(id);
  return r ? regToPlugin(db, r) : null;
}

export async function createPluginItem(data: Partial<Plugin>): Promise<Plugin> {
  const db = getDb();
  const store = getLocalStore();
  const reg = getPluginRegistrySync();
  if (!db || !store || !reg) {
    return createPlugin({
      name: data.name ?? 'new-plugin',
      version: data.version ?? '1.0.0',
      enabled: data.enabled ?? true,
      description: data.description ?? '',
      author: data.author ?? 'user',
    });
  }
  const crud = new MarketplaceCrud(store, new WorkbenchMarketplaceAuditWriter(db));
  const pluginName = data.name ?? 'new-plugin';
  const toolName = pluginName.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  const res = await crud.create({ name: pluginName, kind: 'skill' as PluginKind, description: data.description ?? '', permissions: [], external_agent_compat: [], tool: { name: toolName, description: data.description ?? '', inputSchema: { type: 'object', properties: {}, required: [] } } });
  if (!res.ok) throw new Error('plugin create failed');
  writePluginMeta(db, res.pluginName, { description: data.description ?? '', author: data.author ?? 'local' });
  if (data.config) writePluginConfig(db, res.pluginName, data.config);
  const csf = await store.get(res.pluginName);
  if (!csf) throw new Error('plugin not found after create');
  if (data.enabled !== false) {
    await installLocalPlugin(res.pluginName);
    return regToPlugin(db, reg.get(res.pluginName));
  }
  return regToPlugin(db, fallbackRegisteredPlugin(csf));
}

export async function updatePluginItem(id: string, data: Partial<Plugin>): Promise<Plugin | null> {
  const reg = getPluginRegistrySync();
  const db = getDb();
  if (!reg || !db) return updatePlugin(id, data) ?? null;
  if (data.description !== undefined || data.author !== undefined) {
    const cur = readPluginMeta(db, id);
    writePluginMeta(db, id, { description: data.description ?? cur.description, author: data.author ?? cur.author });
  }
  if (data.config !== undefined) writePluginConfig(db, id, data.config);
  if (data.enabled !== undefined) {
    const cur = reg.find(id);
    if (cur) {
      await reg.setState(id, data.enabled ? 'active' : 'inactive');
      await reg.flush();
    }
  }
  const r = reg.find(id);
  return r ? regToPlugin(db, r) : null;
}

export async function deletePluginItem(id: string): Promise<boolean> {
  const reg = getPluginRegistrySync();
  const db = getDb();
  if (!reg || !db) return deletePlugin(id);
  try {
    await reg.unregister(id);
    await reg.flush();
  } catch {
    return false;
  }
  db.prepare(`DELETE FROM workbench_plugin_meta WHERE name=?`).run(id);
  db.prepare(`DELETE FROM workbench_plugin_config WHERE name=?`).run(id);
  return true;
}

export async function togglePluginItem(id: string): Promise<boolean> {
  const reg = getPluginRegistrySync();
  const db = getDb();
  if (!reg || !db) return togglePlugin(id);
  const cur = reg.find(id);
  if (!cur) return false;
  await reg.setState(id, cur.state === 'active' ? 'inactive' : 'active');
  await reg.flush();
  return true;
}

export async function getPluginConfig(id: string): Promise<string> {
  const db = getDb();
  if (!db) return getPlugins().find((p) => p.id === id)?.config ?? '';
  return readPluginConfig(db, id);
}

export async function updatePluginConfig(id: string, config: string): Promise<boolean> {
  const db = getDb();
  if (!db) return !!updatePlugin(id, { config });
  writePluginConfig(db, id, config);
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP TOKENS (persisted when the engine is real; demo fallback otherwise)
// ═══════════════════════════════════════════════════════════════════════════

export interface McpToken {
  id: string;
  client: string;
  scopes_json: string;
  expires_at: string;
}

export async function issueMcpToken(client: string, scopes: string[]): Promise<McpToken> {
  const db = getDb();
  const id = `tok_${Date.now().toString(36)}`;
  const scopes_json = JSON.stringify(scopes);
  const expires_at = new Date(Date.now() + 86400000).toISOString();
  if (!db) {
    const { issueMCPToken } = await import('@/lib/demo-store');
    return issueMCPToken(client, scopes);
  }
  db.prepare(
    `INSERT INTO mcp_tokens (id, client, scopes_json, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, client, scopes_json, expires_at, new Date().toISOString());
  return { id, client, scopes_json, expires_at };
}

export async function listMcpTokens(): Promise<McpToken[]> {
  const db = getDb();
  if (!db) {
    const { getMCPTokens } = await import('@/lib/demo-store');
    return getMCPTokens();
  }
  return db
    .prepare('SELECT id, client, scopes_json, expires_at FROM mcp_tokens ORDER BY created_at DESC')
    .all() as McpToken[];
}

export async function revokeMcpToken(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const { revokeMCPToken } = await import('@/lib/demo-store');
    return revokeMCPToken(id);
  }
  return db.prepare('DELETE FROM mcp_tokens WHERE id = ?').run(id).changes > 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// SKILL HELPERS (real CSF store + MarketplaceCrud + side tables)
// ═══════════════════════════════════════════════════════════════════════════

export async function getAllSkills(): Promise<Skill[]> {
  const db = getDb();
  const store = getLocalStore();
  if (!db || !store) return getSkills();
  const csfs = await store.list();
  return csfs.map((csf) => csfToSkill(db, csf));
}

export async function createSkillItem(data: Partial<Skill>): Promise<Skill> {
  const db = getDb();
  const store = getLocalStore();
  if (!db || !store) {
    return createSkill({
      name: data.name ?? 'new-skill',
      category: data.category ?? 'general',
      version: data.version ?? '1.0.0',
      enabled: data.enabled ?? true,
      description: data.description ?? '',
    });
  }
  const crud = new MarketplaceCrud(store, new WorkbenchMarketplaceAuditWriter(db));
  const skillName = data.name ?? 'new-skill';
  const toolName = skillName.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  const res = await crud.create({ name: skillName, kind: 'skill' as PluginKind, description: data.description ?? '', permissions: [], external_agent_compat: [], tool: { name: toolName, description: data.description ?? '', inputSchema: { type: 'object', properties: {}, required: [] } } });
  if (!res.ok) throw new Error('skill create failed');
  writePluginMeta(db, res.pluginName, { description: data.description ?? '', category: data.category ?? 'general' });
  if (data.config) writePluginConfig(db, res.pluginName, data.config);
  writeSkillState(db, res.pluginName, data.enabled !== false);
  const csf = await store.get(res.pluginName);
  if (!csf) throw new Error('skill not found after create');
  return csfToSkill(db, csf);
}

export async function updateSkillItem(id: string, data: Partial<Skill>): Promise<Skill | null> {
  const db = getDb();
  const store = getLocalStore();
  if (!db || !store) return updateSkill(id, data) ?? null;
  if (data.description !== undefined) {
    const cur = readPluginMeta(db, id);
    writePluginMeta(db, id, { description: data.description ?? cur.description });
  }
  if (data.category !== undefined) writePluginMeta(db, id, { category: data.category });
  if (data.enabled !== undefined) writeSkillState(db, id, data.enabled);
  if (data.config !== undefined) writePluginConfig(db, id, data.config);
  const crud = new MarketplaceCrud(store, new WorkbenchMarketplaceAuditWriter(db));
  await crud.update({ name: id, bump: 'patch', changes: {} });
  const csf = await store.get(id);
  return csf ? csfToSkill(db, csf) : null;
}

export async function deleteSkillItem(id: string): Promise<boolean> {
  const db = getDb();
  const store = getLocalStore();
  if (!db || !store) return deleteSkill(id);
  const crud = new MarketplaceCrud(store, new WorkbenchMarketplaceAuditWriter(db));
  try {
    await crud.delete({ name: id, confirmation: `DELETE ${id}` });
  } catch {
    return false;
  }
  db.prepare(`DELETE FROM workbench_plugin_meta WHERE name=?`).run(id);
  db.prepare(`DELETE FROM workbench_plugin_config WHERE name=?`).run(id);
  db.prepare(`DELETE FROM workbench_skill_state WHERE name=?`).run(id);
  return true;
}

export async function toggleSkillItem(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return toggleSkill(id);
  writeSkillState(db, id, !readSkillState(db, id));
  return true;
}

export interface SkillInvocationResult {
  ok: boolean;
  skillId: string;
  skillName: string;
  prompt: string;
  output: string;
  durationMs: number;
}

export async function invokeSkill(id: string, prompt: string): Promise<SkillInvocationResult | null> {
  const db = getDb();
  const store = getLocalStore();
  if (!db || !store) return null;
  const csf = await store.get(id);
  if (!csf) return null;
  const output = typeof csf.implementation?.source === 'string' ? csf.implementation.source : '[no implementation]';
  db.prepare(`INSERT INTO workbench_skill_invocations (name, invoked_at, prompt, output) VALUES (?, ?, ?, ?)`)
    .run(id, new Date().toISOString(), prompt, output);
  return { ok: true, skillId: id, skillName: csf.name, prompt, output, durationMs: 0 };
}

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
  try {
    const dbPath = process.env.ORQENIX_DB ?? join(process.cwd(), '.orqenix', 'memory.db');
    const engine = await MemoryEngine.open(dbPath, {
      projectId: PROJECT_ID,
      bootstrapBaseTables: true,
      failOnDrift: false,
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
    console.error('[engine-init] MemoryEngine init failed, using demo-store fallback:', (err as Error).message);
    if (process.env.ORQENIX_STRICT) throw err;
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

function getDb(): Database | null {
  const e = globalThis.__orqenixMemory;
  return e ? e.getStore().db : null;
}

function getLocalStore(): SqliteLocalPluginStore | null {
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
