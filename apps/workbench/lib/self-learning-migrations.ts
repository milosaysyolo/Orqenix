// SPDX-License-Identifier: Apache-2.0
// Workbench , composes engine + self-learning migrations
//
// Avoids the memory-engine → self-learning dependency cycle by composing at the
// Workbench layer. Run once at startup after MemoryEngine.open.

import { ALL_PHASE_8_CORE_MIGRATIONS, MigrationRunner } from '@orqenix/memory-engine';
import { SELF_LEARNING_MIGRATIONS } from '@orqenix/self-learning-observer';
import type { MemoryEngine } from '@orqenix/memory-engine';

/**
 * Applies self-learning migrations (530) on top of the core engine migrations.
 * Idempotent: skips already-applied migrations.
 */
export function applySelfLearningMigrations(engine: MemoryEngine): {
  applied: number[];
  skipped: number[];
} {
  const db = engine.getStore().db;
  const runner = new MigrationRunner(db);
  // self-learning migrations carry the same Migration shape
  const composed = [...ALL_PHASE_8_CORE_MIGRATIONS, ...SELF_LEARNING_MIGRATIONS].sort(
    (a, b) => a.id - b.id
  );
  return runner.apply(composed);
}
