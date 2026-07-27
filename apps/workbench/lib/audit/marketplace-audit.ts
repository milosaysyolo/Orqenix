// SPDX-License-Identifier: Apache-2.0
// Workbench , MarketplaceAuditWriter backed by the `marketplace_audit` side table.
// marketplace-core ships no Noop impl; this persists CRUD/import/export events.

import type { Database } from 'better-sqlite3';
import type { MarketplaceAuditKind, MarketplaceAuditWriter } from '@orqenix/marketplace-core';

export class WorkbenchMarketplaceAuditWriter implements MarketplaceAuditWriter {
  constructor(private readonly db: Database) {}

  async append(event: {
    kind: MarketplaceAuditKind;
    ts: string;
    actor: { user: string };
    payload: Record<string, unknown>;
    project_id: string;
  }): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO marketplace_audit (ts, kind, actor, project_id, payload_json)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(event.ts, event.kind, event.actor.user, event.project_id, JSON.stringify(event.payload));
  }
}
