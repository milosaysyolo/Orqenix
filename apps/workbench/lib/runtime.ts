// SPDX-License-Identifier: Apache-2.0
// Thin assembly over engine-init (the single source of the engine graph).
// Production routes call engine-init accessors directly; tests use getRuntime().

import { VerificationLoop, MockSkillExecutor } from '@orqenix/verification-loop';
import { NormalizationEngine } from '@orqenix/normalization-engine';
import { ALL_INPUT_ADAPTERS } from '@orqenix/input-adapters';
import { ALL_OUTPUT_ADAPTERS } from '@orqenix/output-adapters';

import {
  ensureInit, getMemory, getSettings,
  getObserverSync, getDetectorSync, getPromoterSync,
  getSkillGenesisSync, getMarketplaceSync,
} from './engine-init';
import { eventBus } from './event-bus';
import { PROJECT_ID } from './stores/session-store';

export interface OrqenixRuntime {
  projectId: string;
  projectPath: string;
  engine: import('@orqenix/memory-engine').MemoryEngine;
  observer: import('@orqenix/self-learning-observer').Observer;
  detector: import('@orqenix/self-learning-detection').BasicDetector;
  skillGenesis: import('@orqenix/skill-genesis').SkillGenesis;
  promoter: import('@orqenix/instinct-promoter').PromoterService;
  verification: VerificationLoop;
  settings: import('@orqenix/settings-registry').SettingsRegistry;
  marketplace: import('@orqenix/marketplace-core').MarketplaceManager;
  normalization: NormalizationEngine;
}

declare global {
  // eslint-disable-next-line no-var
  var __orqenixRuntime: OrqenixRuntime | undefined;
  // eslint-disable-next-line no-var
  var __orqenixRuntimePromise: Promise<OrqenixRuntime> | undefined;
}

function resolveProjectPath(): string {
  return process.env.ORQENIX_PROJECT ?? process.cwd();
}

async function construct(): Promise<OrqenixRuntime> {
  await ensureInit();
  const engine = await getMemory();
  if (!engine) throw new Error('MemoryEngine failed to initialize (see getEngineStatus()).');
  const observer = getObserverSync();
  const detector = getDetectorSync();
  const promoter = getPromoterSync();
  const skillGenesis = getSkillGenesisSync();
  const marketplace = getMarketplaceSync();
  const settings = await getSettings();
  if (!observer || !detector || !promoter || !skillGenesis || !marketplace) {
    throw new Error('One or more engine subsystems failed to initialize (see getEngineStatus()).');
  }
  const db = engine.getStore().db;
  const verification = new VerificationLoop({ db, executor: new MockSkillExecutor(1.0), observer });
  const normalization = new NormalizationEngine({
    inputAdapters: ALL_INPUT_ADAPTERS,
    outputAdapters: ALL_OUTPUT_ADAPTERS,
  });
  const runtime: OrqenixRuntime = {
    projectId: PROJECT_ID,
    projectPath: resolveProjectPath(),
    engine, observer, detector, skillGenesis, promoter,
    verification, settings, marketplace, normalization,
  };
  eventBus.emit({ kind: 'runtime.ready', ts: new Date().toISOString(), payload: { projectId: PROJECT_ID } });
  return runtime;
}

export function getRuntime(): Promise<OrqenixRuntime> {
  if (globalThis.__orqenixRuntime) return Promise.resolve(globalThis.__orqenixRuntime);
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
