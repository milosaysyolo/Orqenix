// SPDX-License-Identifier: Apache-2.0
// Workbench , SQLite-backed RegistryPersistence for @orqenix/plugin-core.
// Maps RegisteredPlugin <-> the MemoryEngine `installed_plugins` table (mig 540).

import type { Database } from 'better-sqlite3';
import type { CanonicalSkillFormat, RegisteredPlugin } from '@orqenix/plugin-core';
import { PluginRegistry } from '@orqenix/plugin-core';

// RegistryPersistence is declared in plugin-core but not re-exported from the
// package root; derive it from the registry's constructor signature instead.
type RegistryPersistence = NonNullable<ConstructorParameters<typeof PluginRegistry>[0]>;

export class SqlitePluginPersistence implements RegistryPersistence {
  constructor(private readonly db: Database) {}

  async load(): Promise<RegisteredPlugin[]> {
    const rows = this.db.prepare(`SELECT * FROM installed_plugins`).all() as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      csf: JSON.parse(r.manifest_json as string) as CanonicalSkillFormat,
      packagePath: (r.package_path as string) ?? (r.package_name as string),
      state: r.state as RegisteredPlugin['state'],
      installedAt: r.installed_at as string,
      lastActivatedAt: (r.last_activated_at as string | null) ?? null,
      crashCount: (r.crash_count as number) ?? 0,
      totalInvocations: (r.total_invocations as number) ?? 0,
      totalErrors: (r.total_errors as number) ?? 0,
    }));
  }

  async save(plugins: RegisteredPlugin[]): Promise<void> {
    const upsert = this.db.prepare(
      `INSERT INTO installed_plugins
         (id, package_name, version, kind, package_path, state, installed_at, last_activated_at,
          crash_count, total_invocations, total_errors, manifest_json)
       VALUES
         (@id, @package_name, @version, @kind, @package_path, @state, @installed_at, @last_activated_at,
          @crash_count, @total_invocations, @total_errors, @manifest_json)
       ON CONFLICT(package_name) DO UPDATE SET
         version=excluded.version, kind=excluded.kind, package_path=excluded.package_path,
         state=excluded.state, installed_at=excluded.installed_at, last_activated_at=excluded.last_activated_at,
         crash_count=excluded.crash_count, total_invocations=excluded.total_invocations,
         total_errors=excluded.total_errors, manifest_json=excluded.manifest_json`,
    );
    const tx = this.db.transaction((ps: RegisteredPlugin[]) => {
      for (const p of ps) {
        upsert.run({
          id: p.csf.name,
          package_name: p.csf.name,
          version: p.csf.version,
          kind: p.csf.kind,
          package_path: p.packagePath,
          state: p.state,
          installed_at: p.installedAt,
          last_activated_at: p.lastActivatedAt ?? new Date().toISOString(),
          crash_count: p.crashCount,
          total_invocations: p.totalInvocations,
          total_errors: p.totalErrors,
          manifest_json: JSON.stringify(p.csf),
        });
      }
    });
    tx(plugins);
  }
}
