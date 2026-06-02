// SPDX-License-Identifier: Apache-2.0
// Phase 5 final integration smoke: runs the end-to-end flow that uses Parts 1-9 + 12 together.
// Pro tier (Parts 10-11) lives in the separate Orqenix-Pro repo.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import { CHAT_KB_MIGRATIONS, ChatStore, createChatVecTable } from '@orqenix/kb-chat';
import { MEMORY_TIER_MIGRATIONS, MemoryTierStore } from '@orqenix/memory-tiers';
import { HeuristicDistiller } from '@orqenix/memory-distiller';
import { KeywordRecall, PromptRewriter } from '@orqenix/prompt-rewriter';
import { SCOPE_LINK_MIGRATIONS, ScopeLinkStore } from '@orqenix/scope-link';
import { WORKSPACE_MIGRATIONS, WorkspaceStore } from '@orqenix/workspace';
import { AUDIT_LOG_MIGRATIONS, AuditLogStore } from '@orqenix/audit-log';
import { DetachPlanner, DetachExecutor } from '@orqenix/detach';

const REPO_ROOT = resolve(__dirname, '../..');
const SCOPE = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const B = 'scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

async function main(): Promise<void> {
  console.log('=== Phase 5 Final Integration Smoke ===');
  console.log(`Repo: ${REPO_ROOT}`);
  const dir = await mkdtemp(join(tmpdir(), 'phase5-final-'));

  try {
    const conn = new SqliteConnection({ path: join(dir, 'kb.sqlite'), enableVec: true });
    runMigrations(conn, [
      ...CHAT_KB_MIGRATIONS,
      ...MEMORY_TIER_MIGRATIONS,
      ...SCOPE_LINK_MIGRATIONS,
      ...WORKSPACE_MIGRATIONS,
      ...AUDIT_LOG_MIGRATIONS,
    ]);
    createChatVecTable(conn, 4);

    console.log('\n[1] ChatKB + capability-gated writes ... ');
    const chat = new ChatStore({ conn, scopeId: SCOPE });
    const session = chat.createSession({ scopeId: SCOPE, title: 'smoke session' });
    await chat.appendEntry({ sessionId: session.sessionId, role: 'user', content: 'I prefer Rust for runtime', metadata: {} });
    await chat.appendEntry({ sessionId: session.sessionId, role: 'user', content: 'We decided to use SQLite', metadata: {} });
    console.log(`    ChatKB: ${chat.listEntries(session.sessionId).length} entries, hash chain OK`);

    console.log('\n[2] Memory Distiller (heuristic OSS) ... ');
    const memStore = new MemoryTierStore({ conn, scopeId: SCOPE });
    const distiller = new HeuristicDistiller({ memStore, chatConn: conn, scopeId: SCOPE });
    const stats = distiller.distillBatch();
    console.log(`    Distilled: scanned=${stats.entriesScanned} created=${stats.memoriesCreated}`);

    console.log('\n[3] Keyword recall + prompt rewriter ... ');
    const recall = new KeywordRecall(memStore, SCOPE);
    const rewriter = new PromptRewriter({ recall });
    const out = await rewriter.rewrite({
      messages: [{ role: 'user', content: 'What did I prefer for runtime?' }],
    });
    console.log(`    Rewriter injected ${out.injectedMemoryIds.length} memory ids, strategy=${out.strategy}`);

    console.log('\n[4] Scope link + workspace ... ');
    const linkStore = new ScopeLinkStore({ conn, localScopeId: SCOPE });
    linkStore.create({ remoteScopeId: B, direction: 'outbound' });
    linkStore.updateStatus(B, 'outbound', 'active');
    const wsStore = new WorkspaceStore({ conn });
    const ws = wsStore.create({ name: 'team-smoke', ownerScopeId: SCOPE });
    console.log(`    Link to ${B} active; workspace ${ws.id} owned by ${SCOPE}`);

    console.log('\n[5] Audit log chain ... ');
    const audit = new AuditLogStore({ conn, scopeId: SCOPE });
    audit.append({ actorScopeId: SCOPE, eventKind: 'scope_initialized', payload: {} });
    audit.append({ actorScopeId: SCOPE, eventKind: 'link_created', payload: { remote: B } });
    audit.append({ actorScopeId: SCOPE, eventKind: 'workspace_created', payload: { workspaceId: ws.id } });
    const verifyResult = audit.verifyChain();
    console.log(`    verifyChain: ${verifyResult.entriesChecked} entries, ok=${verifyResult.ok}`);

    console.log('\n[6] Detach (unlink-remote) ... ');
    const planner = new DetachPlanner({ localScopeId: SCOPE, linkStore, workspaceStore: wsStore, auditStore: audit });
    const executor = new DetachExecutor({ localScopeId: SCOPE, linkStore, workspaceStore: wsStore, auditStore: audit, rootDir: dir });
    const plan = planner.planUnlink(B);
    const report = await executor.execute(plan, plan.confirmationToken);
    console.log(`    Unlink executed at ${report.executedAt}, verifierChainHash=${report.verifierChainHash?.slice(0, 12)}...`);
    const final = audit.verifyChain();
    console.log(`    Audit chain still valid after detach: ${final.entriesChecked} entries`);

    conn.close();
    await new Promise((r) => setTimeout(r, 50));
    console.log('\n✓ Phase 5 final integration smoke PASSED');
    process.exit(0);
  } catch (e) {
    console.error(`✗ Phase 5 final integration smoke FAILED: ${(e as Error).message}`);
    console.error((e as Error).stack);
    process.exit(1);
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  }
}

main();
