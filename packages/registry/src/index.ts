import Database from "better-sqlite3";

export interface RegistryEntry {
  id: string;
  name: string;
  version: string;
  type: "skill" | "agent" | "team_bundle";
  state: "ACTIVE" | "STALE" | "TRASH" | "PURGED";
  createdAt: string;
  updatedAt: string;
}

export class Registry {
  private db: Database.Database;

  static async open(dbPath: string): Promise<Registry> {
    const db = new Database(dbPath);
    const reg = new Registry(db);
    reg.initSchema();
    return reg;
  }

  constructor(db: Database.Database) {
    this.db = db;
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS registry (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        type TEXT NOT NULL,
        state TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_registry_name ON registry(name);
      CREATE INDEX IF NOT EXISTS idx_registry_type ON registry(type);
      CREATE INDEX IF NOT EXISTS idx_registry_state ON registry(state);
    `);
  }

  async add(entry: Omit<RegistryEntry, "createdAt" | "updatedAt">): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO registry (id, name, version, type, state, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(entry.id, entry.name, entry.version, entry.type, entry.state, now, now);
  }

  async get(id: string): Promise<RegistryEntry | null> {
    const stmt = this.db.prepare("SELECT * FROM registry WHERE id = ?");
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.rowToEntry(row);
  }

  async list(type?: string): Promise<RegistryEntry[]> {
    let stmt: Database.Statement;
    if (type) {
      stmt = this.db.prepare("SELECT * FROM registry WHERE type = ? ORDER BY updated_at DESC");
      const rows = stmt.all(type) as any[];
      return rows.map(r => this.rowToEntry(r));
    } else {
      stmt = this.db.prepare("SELECT * FROM registry ORDER BY updated_at DESC");
      const rows = stmt.all() as any[];
      return rows.map(r => this.rowToEntry(r));
    }
  }

  async update(id: string, updates: Partial<RegistryEntry>): Promise<void> {
    const current = await this.get(id);
    if (!current) throw new Error(`Registry entry not found: ${id}`);

    const merged: RegistryEntry = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE registry SET name = ?, version = ?, type = ?, state = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(merged.name, merged.version, merged.type, merged.state, merged.updatedAt, id);
  }

  async remove(id: string): Promise<void> {
    const stmt = this.db.prepare("DELETE FROM registry WHERE id = ?");
    stmt.run(id);
  }

  async checkConflicts(entry: RegistryEntry): Promise<RegistryEntry[]> {
    const stmt = this.db.prepare(
      "SELECT * FROM registry WHERE name = ? AND id != ? AND state != ?",
    );
    const rows = stmt.all(entry.name, entry.id, "PURGED") as any[];
    return rows.map(r => this.rowToEntry(r));
  }

  private rowToEntry(row: any): RegistryEntry {
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      type: row.type,
      state: row.state,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
