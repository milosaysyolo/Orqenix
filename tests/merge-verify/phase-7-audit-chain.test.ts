// SPDX-License-Identifier: Apache-2.0
// PHASE 7 SMOKE: BLAKE3 audit chain (single chain per project, verifiable).

import { describe, it, expect, afterEach } from 'vitest';
import { MemoryEngine } from '@orqenix/memory-engine';

const PROJECT = 'blake3:phase7test';

describe('PHASE 7 — Audit Chain (BLAKE3, verifiable)', () => {
  let engine: MemoryEngine;
  afterEach(() => engine?.close());

  it('audit chain is valid after writes', async () => {
    engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true });
    await engine.write({ kb: 'decision', content: 'A', branch_id: 'b', memory_level: 'branch' });
    await engine.write({ kb: 'decision', content: 'B', branch_id: 'b', memory_level: 'branch' });
    const verify = engine.verifyAuditChain();
    expect(verify.valid).toBe(true);
    expect(verify.entriesVerified).toBeGreaterThanOrEqual(2);
  });

  it('audit chain detects tampering (linkage break)', async () => {
    engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true });
    await engine.write({ kb: 'decision', content: 'X', branch_id: 'b', memory_level: 'branch' });
    const db = engine.getStore().db;
    db.prepare("UPDATE audit_entries SET payload = '{\"tampered\":true}' WHERE seq = 1").run();
    const verify = engine.verifyAuditChain();
    expect(verify.valid).toBe(false);
    expect(verify.firstMismatchSeq).not.toBeNull();
  });
});
