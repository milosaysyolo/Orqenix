import Database from "better-sqlite3";
import { createHash } from "node:crypto";

export interface Chunk {
  path: string;
  heading: string[];
  text: string;
  startLine: number;
  endLine: number;
}

export function chunkMarkdown(path: string, content: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = content.split("\n");
  let currentHeadings: string[] = [];
  let buffer: string[] = [];
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      if (buffer.length > 0) {
        const text = buffer.join("\n").trim();
        if (text) {
          chunks.push({
            path,
            heading: [...currentHeadings],
            text,
            startLine,
            endLine: i,
          });
        }
        buffer = [];
      }

      const level = headingMatch[1]!.length;
      currentHeadings = currentHeadings.slice(0, level - 1);
      currentHeadings.push(headingMatch[2]!);
      startLine = i + 1;
    } else {
      buffer.push(line);
    }
  }

  if (buffer.length > 0) {
    const text = buffer.join("\n").trim();
    if (text) {
      chunks.push({
        path,
        heading: [...currentHeadings],
        text,
        startLine,
        endLine: lines.length,
      });
    }
  }

  return chunks;
}

export interface DocResult {
  id: string;
  path: string;
  heading: string[];
  text: string;
  score: number;
}

export class DocsKB {
  private db: Database.Database;

  static async open(dbPath: string): Promise<DocsKB> {
    const db = new Database(dbPath);
    const kb = new DocsKB(db);
    kb.initSchema();
    return kb;
  }

  constructor(db: Database.Database) {
    this.db = db;
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS docs (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        heading_path TEXT NOT NULL,
        text TEXT NOT NULL,
        start_line INTEGER,
        end_line INTEGER,
        file_hash TEXT NOT NULL,
        indexed_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_docs_path ON docs(path);
      CREATE INDEX IF NOT EXISTS idx_docs_file_hash ON docs(file_hash);
    `);
  }

  async index(path: string, content: string): Promise<void> {
    const fileHash = createHash("sha256").update(content).digest("hex");
    const chunks = chunkMarkdown(path, content);
    const del = this.db.prepare("DELETE FROM docs WHERE path = ?");
    const insert = this.db.prepare(`
      INSERT INTO docs (id, path, heading_path, text, start_line, end_line, file_hash, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      del.run(path);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        const id = createHash("sha256").update(`${path}:${i}:${fileHash}`).digest("hex");
        insert.run(
          id,
          chunk.path,
          JSON.stringify(chunk.heading),
          chunk.text,
          chunk.startLine,
          chunk.endLine,
          fileHash,
          new Date().toISOString(),
        );
      }
    });

    tx();
  }

  async query(q: string, topK = 5): Promise<DocResult[]> {
    const rows = this.db.prepare("SELECT * FROM docs").all() as any[];
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = rows
      .map(row => {
        const heading = JSON.parse(row.heading_path) as string[];
        const haystack = `${row.path} ${heading.join(" ")} ${row.text}`.toLowerCase();
        const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
        return {
          id: row.id,
          path: row.path,
          heading,
          text: row.text,
          score,
        } satisfies DocResult;
      })
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored;
  }
}
