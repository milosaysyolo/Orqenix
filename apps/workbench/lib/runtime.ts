// SPDX-License-Identifier: Apache-2.0

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';

import { MemoryEngine } from '@orqenix/memory-engine';
import {
  ALL_PHASE_8_CORE_MIGRATIONS,
  MigrationRunner,
  BASE_KB_BOOTSTRAP,
} from '@orqenix/memory-engine';
import { SELF_LEARNING_MIGRATIONS, Observer, BasicPiiFilter } from '@orqenix/self-learning-observer';
import { BasicDetector } from '@orqenix/self-learning-detection';
import { SkillGenesis } from '@orqenix/skill-genesis';
import { PromoterService } from '@orqenix/instinct-promoter';
import { VerificationLoop, MockSkillExecutor } from '@orqenix/verification-loop';
import { SettingsRegistry } from '@orqenix/settings-registry';
import { MarketplaceManager, RegistryResolverRegistry } from '@orqenix/marketplace-core';
import { NormalizationEngine } from '@orqenix/normalization-engine';
import { ALL_INPUT_ADAPTERS } from '@orqenix/input-adapters';
import { ALL_OUTPUT_ADAPTERS } from '@orqenix/output-adapters';

import { SqliteLocalPluginStore } from './marketplace-store';
import { bootstrapSettings } from './settings-bootstrap';
import { eventBus } from './event-bus';
import { MEMORY_LINK_MIGRATIONS } from './migrations/570-memory-links';
import { AGENT_MIGRATIONS } from './migrations/580-agents';
import { WORKBENCH_STATE_MIGRATIONS } from './migrations/590-workbench-state';
import { WorkbenchPluginLifecycle } from './plugin-lifecycle';

export interface OrqenixRuntime {
  projectId: string;
  projectPath: string;
  engine: MemoryEngine;
  observer: Observer;
  detector: BasicDetector;
  skillGenesis: SkillGenesis;
  promoter: PromoterService;
  verification: VerificationLoop;
  settings: SettingsRegistry;
  marketplace: MarketplaceManager;
  normalization: NormalizationEngine;
}

declare global {
  // eslint-disable-next-line no-var
  var __orqenixRuntime: OrqenixRuntime | undefined;
  // eslint-disable-next-line no-var
  var __orqenixRuntimePromise: Promise<OrqenixRuntime> | undefined;
}

async function readProjectId(projectPath: string): Promise<string> {
  const dir = join(projectPath, '.orqenix');
  for (const file of ['project.yaml', 'scope.yaml']) {
    const p = join(dir, file);
    if (existsSync(p)) {
      const content = await readFile(p, 'utf-8');
      const m = /(?:project_id|scope_id):\s*(\S+)/.exec(content);
      if (m) return m[1] as string;
    }
  }
  return 'blake3:7f2ac8d1devworkbench00';
}

function resolveProjectPath(): string {
  return process.env.ORQENIX_PROJECT ?? process.cwd();
}

async function construct(): Promise<OrqenixRuntime> {
  const projectPath = resolveProjectPath();
  const projectId = await readProjectId(projectPath);

  const dbPath =
    process.env.ORQENIX_DB ??
    join(projectPath, '.orqenix', 'memory.db');

  const bootstrapBase = !existsSync(dbPath) || process.env.ORQENIX_DEV === '1';
  const engine = await MemoryEngine.open(dbPath, {
    projectId,
    bootstrapBaseTables: bootstrapBase,
    failOnDrift: false,
  });

  const db = engine.getStore().db;

  const runner = new MigrationRunner(db);
  const allMigrations = [...ALL_PHASE_8_CORE_MIGRATIONS, ...SELF_LEARNING_MIGRATIONS, ...MEMORY_LINK_MIGRATIONS, ...AGENT_MIGRATIONS, ...WORKBENCH_STATE_MIGRATIONS].sort(
    (a, b) => a.id - b.id
  );
  runner.apply(allMigrations, false);

  const observer = new Observer({ db, piiFilter: new BasicPiiFilter() });
  const detector = new BasicDetector({ db });
  const skillGenesis = new SkillGenesis({ db, observer });
  const promoter = new PromoterService({
    db,
    candidateStore: detector.getCandidateStore(),
    observer,
    skillGenesis,
    audit: engine.getAuditWriter() as never,
  });
  const verification = new VerificationLoop({
    db,
    executor: new MockSkillExecutor(1.0),
    observer,
  });

  const settings = new SettingsRegistry({});
  await bootstrapSettings(settings);

  const normalization = new NormalizationEngine({
    inputAdapters: ALL_INPUT_ADAPTERS,
    outputAdapters: ALL_OUTPUT_ADAPTERS,
  });
  const lifecycle = new WorkbenchPluginLifecycle(engine);
  const marketplace = new MarketplaceManager({
    store: new SqliteLocalPluginStore(engine),
    audit: engine.getAuditWriter() as never,
    normalizationEngine: normalization,
    lifecycle: lifecycle as never,
    resolverRegistry: new RegistryResolverRegistry(),
    actor: 'workbench-user',
    projectId,
  });

  const runtime: OrqenixRuntime = {
    projectId,
    projectPath,
    engine,
    observer,
    detector,
    skillGenesis,
    promoter,
    verification,
    settings,
    marketplace,
    normalization,
  };

  eventBus.emit({ kind: 'runtime.ready', ts: new Date().toISOString(), payload: { projectId } });

  return runtime;
}

export function getRuntime(): Promise<OrqenixRuntime> {
  if (globalThis.__orqenixRuntime) {
    return Promise.resolve(globalThis.__orqenixRuntime);
  }
  if (!globalThis.__orqenixRuntimePromise) {
    globalThis.__orqenixRuntimePromise = construct().then((rt) => {
      globalThis.__orqenixRuntime = rt;
      return rt;
    });
  }
  return globalThis.__orqenixRuntimePromise;
}

export function getRuntimeSync(): OrqenixRuntime {
  if (!globalThis.__orqenixRuntime) {
    throw new Error('Runtime not initialized. Call getRuntime() first (await it in a route).');
  }
  return globalThis.__orqenixRuntime;
}
