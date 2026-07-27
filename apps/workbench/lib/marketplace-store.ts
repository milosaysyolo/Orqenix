// SPDX-License-Identifier: Apache-2.0
// Workbench , SQLite-backed LocalPluginStore (wires marketplace-core)

import type { LocalPluginStore } from "@orqenix/marketplace-core";
import type { CanonicalSkillFormat } from "@orqenix/plugin-core";
import type { MemoryEngine } from "@orqenix/memory-engine";

/**
 * SQLite-backed local plugin store using memory-engine's store + local_plugins
 * table (Migration 550). Replaces the in-memory stub.
 */
export class SqliteLocalPluginStore implements LocalPluginStore {
  constructor(private readonly engine: MemoryEngine) {}

  async get(name: string): Promise<CanonicalSkillFormat | null> {
    const db = this.engine.getStore().db;
    const row = db.prepare("SELECT csf_json FROM local_plugins WHERE name = ?").get(name) as
      | { csf_json: string }
      | undefined;
    if (!row) return null;
    return JSON.parse(row.csf_json) as CanonicalSkillFormat;
  }

  async set(csf: CanonicalSkillFormat): Promise<void> {
    const db = this.engine.getStore().db;
    db.prepare(
      `INSERT INTO local_plugins (name, csf_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET csf_json = excluded.csf_json, updated_at = excluded.updated_at`,
    ).run(csf.name, JSON.stringify(csf), new Date().toISOString());
  }

  async delete(name: string): Promise<void> {
    const db = this.engine.getStore().db;
    db.prepare("DELETE FROM local_plugins WHERE name = ?").run(name);
  }

  async list(): Promise<CanonicalSkillFormat[]> {
    const db = this.engine.getStore().db;
    const rows = db.prepare("SELECT csf_json FROM local_plugins").all() as Array<{
      csf_json: string;
    }>;
    return rows.map((r) => JSON.parse(r.csf_json) as CanonicalSkillFormat);
  }
}
