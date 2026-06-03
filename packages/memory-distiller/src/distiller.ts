import type { SqliteConnection } from '@orqenix/storage-sqlite';
import {
  MemoryTierStore, classifyInitialTier, inferTypeFromContent,
  type MemoryEntry, type MemoryType,
} from '@orqenix/memory-tiers';
import { extractFromText } from './extractor.js';
import {
  DistillerConfigSchema, DEFAULT_DISTILLER_CONFIG,
  type DistillationStats, type DistillerConfig,
} from './contracts.js';

interface ChatEntryRow {
  rowid: number;
  entry_id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

interface DistillerOpts {
  memStore: MemoryTierStore;
  chatConn: SqliteConnection;
  scopeId: string;
  config?: Partial<DistillerConfig>;
  now?: () => string;
}

export class HeuristicDistiller {
  private readonly memStore: MemoryTierStore;
  private readonly chatConn: SqliteConnection;
  private readonly scopeId: string;
  private readonly cfg: DistillerConfig;
  private readonly now: () => string;

  constructor(opts: DistillerOpts) {
    this.memStore = opts.memStore;
    this.chatConn = opts.chatConn;
    this.scopeId = opts.scopeId;
    this.cfg = DistillerConfigSchema.parse({ ...DEFAULT_DISTILLER_CONFIG, ...(opts.config ?? {}) });
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  private readWatermark(): number {
    const row = this.chatConn.prepare<{ last_entry_id: string | null }>(
      `SELECT last_entry_id FROM memory_distiller_watermarks WHERE scope_id = ?`,
    ).get(this.scopeId) as { last_entry_id: string | null } | undefined;
    if (!row || row.last_entry_id == null) return 0;
    const r = this.chatConn.prepare<{ rowid: number }>(
      `SELECT rowid FROM chat_entries WHERE entry_id = ?`,
    ).get(row.last_entry_id) as { rowid: number } | undefined;
    return r?.rowid ?? 0;
  }

  private writeWatermark(lastEntryId: string): void {
    this.chatConn.prepare(
      `INSERT INTO memory_distiller_watermarks (scope_id, last_entry_id, last_run_at)
       VALUES (?, ?, ?)
       ON CONFLICT(scope_id) DO UPDATE SET last_entry_id = excluded.last_entry_id, last_run_at = excluded.last_run_at`,
    ).run(this.scopeId, lastEntryId, this.now());
  }

  private readBatch(sinceRowid: number): ChatEntryRow[] {
    return this.chatConn.prepare<ChatEntryRow>(
      `SELECT rowid, entry_id, session_id, role, content, created_at
       FROM chat_entries
       WHERE rowid > ? AND role != 'system'
       ORDER BY rowid ASC
       LIMIT ?`,
    ).all(sinceRowid, this.cfg.batchSize) as ChatEntryRow[];
  }

  distillBatch(): DistillationStats {
    const started = process.hrtime.bigint();
    const cpuStart = process.cpuUsage();
    const stats: DistillationStats = {
      entriesScanned: 0, candidatesExtracted: 0, memoriesCreated: 0,
      duplicatesSkipped: 0, durationMs: 0, cpuPercentObserved: 0, throttleSleepMs: 0,
    };

    const since = this.readWatermark();
    const rows = this.readBatch(since);
    if (rows.length === 0) {
      stats.durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      return stats;
    }

    for (const row of rows) {
      stats.entriesScanned++;
      let candidates = extractFromText(row.content, row.entry_id)
        .filter((c) => c.confidence >= this.cfg.minConfidence)
        .filter((c) => this.cfg.enabledTypes.includes(c.type))
        .slice(0, this.cfg.maxCandidatesPerEntry);

      if (candidates.length === 0 && row.content.length >= 24 && this.cfg.minConfidence <= 0.55) {
        const type = inferTypeFromContent(row.content);
        if (type !== 'observation') {
          candidates = [{
            type, content: row.content.trim().slice(0, 2000),
            confidence: 0.55, sourceEntryId: row.entry_id, matchedPattern: 'inferType',
          }];
        }
      }
      stats.candidatesExtracted += candidates.length;

      for (const c of candidates) {
        const tier = classifyInitialTier(c.type, c.confidence);
        const beforeCount = this.memStore.countByTier();
        const entry = this.memStore.insert({
          tier, type: c.type as MemoryType, content: c.content,
          sourceEntryIds: [c.sourceEntryId], confidence: c.confidence,
          scopeId: this.scopeId, metadata: { matchedPattern: c.matchedPattern ?? null },
        } as Omit<MemoryEntry, 'id' | 'contentHash' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>);
        const afterCount = this.memStore.countByTier();
        const totalBefore = beforeCount.working + beforeCount.episodic + beforeCount.semantic + beforeCount.procedural;
        const totalAfter = afterCount.working + afterCount.episodic + afterCount.semantic + afterCount.procedural;
        if (totalAfter > totalBefore) stats.memoriesCreated++;
        else stats.duplicatesSkipped++;
        void entry;
      }
    }

    this.writeWatermark(rows[rows.length - 1]!.entry_id);

    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const u = process.cpuUsage(cpuStart);
    const cpuMs = (u.user + u.system) / 1000;
    stats.durationMs = elapsedMs;
    stats.cpuPercentObserved = elapsedMs > 0 ? (cpuMs / elapsedMs) * 100 : 0;
    return stats;
  }

  distillAll(maxBatches = 1000): DistillationStats[] {
    const out: DistillationStats[] = [];
    for (let i = 0; i < maxBatches; i++) {
      const s = this.distillBatch();
      out.push(s);
      if (s.entriesScanned === 0) break;
    }
    return out;
  }
}
