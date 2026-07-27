// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Migration manifest (UPDATED for D8.γ)

export { HIERARCHY_MIGRATIONS, type Migration } from "./500-hierarchy";
export { MARKETPLACE_MIGRATIONS } from "./550-marketplace";
export { MigrationRunner } from "./runner";

import { HIERARCHY_MIGRATIONS } from "./500-hierarchy";
import { MARKETPLACE_MIGRATIONS } from "./550-marketplace";
import type { Migration } from "./500-hierarchy";

// D8.γ: self-learning migrations (530-539) imported from observer package.
// To avoid a circular dependency, the observer package re-exports its
// SELF_LEARNING_MIGRATIONS, and the Workbench bootstrap composes them with the
// engine migrations at startup. For standalone engine usage, they're optional.

/**
 * All Phase 8 core engine migrations (hierarchy + marketplace).
 * Self-learning migrations (530) are composed at the Workbench layer to avoid
 * a memory-engine → self-learning-observer dependency cycle.
 */
export const ALL_PHASE_8_CORE_MIGRATIONS: Migration[] = [
  ...HIERARCHY_MIGRATIONS,
  ...MARKETPLACE_MIGRATIONS,
].sort((a, b) => a.id - b.id);

export const BASE_KB_BOOTSTRAP = `
CREATE TABLE IF NOT EXISTS chat_entries (
  id TEXT PRIMARY KEY, hash TEXT NOT NULL, tier TEXT NOT NULL,
  content TEXT, embedding BLOB,
  project_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS code_entries (
  id TEXT PRIMARY KEY, hash TEXT NOT NULL, tier TEXT NOT NULL,
  content TEXT, embedding BLOB,
  project_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS decision_entries (
  id TEXT PRIMARY KEY, hash TEXT NOT NULL, tier TEXT NOT NULL,
  content TEXT, embedding BLOB,
  project_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS lesson_entries (
  id TEXT PRIMARY KEY, hash TEXT NOT NULL, tier TEXT NOT NULL,
  content TEXT, embedding BLOB,
  project_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS _orqenix_migrations (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL
) STRICT;
`.trim();
