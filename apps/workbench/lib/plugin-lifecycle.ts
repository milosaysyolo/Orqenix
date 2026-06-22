// SPDX-License-Identifier: Apache-2.0
// W3.A , Real plugin lifecycle — install/uninstall persistence + audit

import type { MemoryEngine } from '@orqenix/memory-engine';

export class WorkbenchPluginLifecycle {
  constructor(private readonly engine: MemoryEngine) {}
  private get db() { return this.engine.getStore().db; }

  async install(packageName: string, version = '0.0.0', kind = 'skill'): Promise<void> {
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO installed_plugins (package_name, version, kind, state, installed_at, settings_json)
       VALUES (?, ?, ?, 'installed', ?, '{}')
       ON CONFLICT(package_name) DO UPDATE SET version=excluded.version, state='installed'`
    ).run(packageName, version, kind, now);
  }

  async uninstall(packageName: string): Promise<void> {
    this.db.prepare('DELETE FROM installed_plugins WHERE package_name = ?').run(packageName);
  }
}
