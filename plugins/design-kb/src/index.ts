// SPDX-License-Identifier: Apache-2.0
// Reference kb-schema plugin: defines a custom "Design Decisions" KB.
//
// Demonstrates extending the default 4 KBs with a 5th custom KB. The migration
// uses ID >= 1000 to avoid collision with core (Phase 8 reserves 500-599).

export interface KbSchemaDefinition {
  kbName: string;
  migrationId: number;
  migrationSql: string;
  columns: Array<{ name: string; type: string }>;
}

/** Returns the custom KB schema definition. Called on plugin install. */
export function defineKB(): KbSchemaDefinition {
  return {
    kbName: 'design',
    migrationId: 1000, // >= 1000 per kb-schema convention
    columns: [
      { name: 'id', type: 'TEXT PRIMARY KEY' },
      { name: 'title', type: 'TEXT NOT NULL' },
      { name: 'figma_url', type: 'TEXT' },
      { name: 'rationale', type: 'TEXT' },
      { name: 'project_id', type: 'TEXT NOT NULL' },
      { name: 'branch_id', type: 'TEXT' },
      { name: 'session_id', type: 'TEXT' },
      { name: 'memory_level', type: 'TEXT' },
      { name: 'created_at', type: 'TEXT NOT NULL' },
    ],
    migrationSql: `
CREATE TABLE IF NOT EXISTS design_entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  figma_url TEXT,
  rationale TEXT,
  project_id TEXT NOT NULL,
  branch_id TEXT,
  session_id TEXT,
  memory_level TEXT,
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS idx_design_project ON design_entries(project_id);
`.trim(),
  };
}
