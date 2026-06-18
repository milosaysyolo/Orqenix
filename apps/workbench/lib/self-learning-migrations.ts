// SPDX-License-Identifier: Apache-2.0
// Workbench , composes engine + self-learning migrations
//
// Avoids the memory-engine → self-learning dependency cycle by composing at the
// Workbench layer. Run once at startup after MemoryEngine.open.

import { MigrationRunner } from '@orqenix/memory-engine';
import { SELF_LEARNING_MIGRATIONS } from '@orqenix/self-learning-observer';
import type { MemoryEngine } from '@orqenix/memory-engine';

/**
 * Applies self-learning migrations (530) on top of the core engine migrations.
 * Core migrations are already applied by MemoryEngine.open(). This applies
 * only the self-learning extensions.
 */
export function applySelfLearningMigrations(engine: MemoryEngine): {
  applied: number[];
  skipped: number[];
} {
  const db = engine.getStore().db;
  const runner = new MigrationRunner(db);
  return runner.apply(SELF_LEARNING_MIGRATIONS);
}
