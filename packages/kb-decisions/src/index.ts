import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export const ENTRY_TYPES = [
  "DecisionRecord",
  "LessonLearned",
  "ConversationCheckpoint",
  "Action",
  "RequirementChange",
  "AssumptionMade",
  "ErrorEncountered",
  "UserPreference",
  "RuleEstablished",
  "ApprovalGranted",
  "DiscoveryMade",
  "ConstraintIdentified",
  "TradeoffMade",
] as const;

export type EntryType = typeof ENTRY_TYPES[number];

export interface DecisionEntry {
  id: string;
  type: EntryType;
  scopeId: string;
  agent?: string;
  sessionId?: string;
  timestamp: string;
  title: string;
  body: string;
  enforcement?: "must" | "should" | "may";
  confidence?: number;
  sourceTrail?: Record<string, unknown>;
}

export class DecisionKB {
  private db: Database.Database;

  static async open(dbPath: string): Promise<DecisionKB> {
    const db = new Database(dbPath);
    const kb = new DecisionKB(db);
    kb.initSchema();
    return kb;
  }

  constructor(db: Database.Database) {
    this.db = db;
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        agent TEXT,
        session_id TEXT,
        timestamp TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        enforcement TEXT,
        confidence REAL,
        source_trail TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_decisions_scope ON decisions(scope_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_decisions_type ON decisions(type);
    `);
  }

  async append(entry: Omit<DecisionEntry, "id" | "timestamp">): Promise<string> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO decisions (id, type, scope_id, agent, session_id, timestamp, title, body, enforcement, confidence, source_trail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      entry.type,
      entry.scopeId,
      entry.agent ?? null,
      entry.sessionId ?? null,
      timestamp,
      entry.title,
      entry.body,
      entry.enforcement ?? null,
      entry.confidence ?? null,
      entry.sourceTrail ? JSON.stringify(entry.sourceTrail) : null,
    );
    return id;
  }

  async getById(id: string): Promise<DecisionEntry | null> {
    const stmt = this.db.prepare("SELECT * FROM decisions WHERE id = ?");
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.rowToEntry(row);
  }

  async listByType(type: EntryType, scope: string, limit = 10): Promise<DecisionEntry[]> {
    const stmt = this.db.prepare(
      "SELECT * FROM decisions WHERE type = ? AND scope_id = ? ORDER BY timestamp DESC LIMIT ?",
    );
    const rows = stmt.all(type, scope, limit) as any[];
    return rows.map(r => this.rowToEntry(r));
  }

  async listByDate(from: string, to: string, scope: string): Promise<DecisionEntry[]> {
    const stmt = this.db.prepare(
      "SELECT * FROM decisions WHERE scope_id = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC",
    );
    const rows = stmt.all(scope, from, to) as any[];
    return rows.map(r => this.rowToEntry(r));
  }

  async semanticSearch(topK = 5): Promise<DecisionEntry[]> {
    const stmt = this.db.prepare("SELECT * FROM decisions ORDER BY timestamp DESC LIMIT ?");
    const rows = stmt.all(topK * 3) as any[];
    const entries = rows.map(r => this.rowToEntry(r));
    return entries.slice(0, topK);
  }

  private rowToEntry(row: any): DecisionEntry {
    return {
      id: row.id,
      type: row.type as EntryType,
      scopeId: row.scope_id,
      agent: row.agent,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      title: row.title,
      body: row.body,
      enforcement: row.enforcement,
      confidence: row.confidence,
      sourceTrail: row.source_trail ? JSON.parse(row.source_trail) : undefined,
    };
  }
}
