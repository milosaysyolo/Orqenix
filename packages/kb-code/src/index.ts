import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { loadParser } from "./parser";
import { extractSymbols as extractSymbolsFromParser } from "./symbols";

export const LANGS = [
  "typescript",
  "javascript",
  "tsx",
  "python",
  "rust",
  "go",
  "java",
  "kotlin",
  "ruby",
  "php",
  "csharp",
  "cpp",
  "c",
  "swift",
  "scala",
  "elixir",
  "html",
  "css",
  "json",
  "yaml",
] as const;

export function startWatcher(root: string, onChange: (path: string) => void) {
  return {
    close() {},
    root,
    onChange,
  };
}

export interface CodeResult {
  id: string;
  path: string;
  kind: string;
  name: string;
  score: number;
}

export class CodeKB {
  private db: Database.Database;

  static async open(dbPath: string): Promise<CodeKB> {
    const db = new Database(dbPath);
    const kb = new CodeKB(db);
    kb.initSchema();
    return kb;
  }

  constructor(db: Database.Database) {
    this.db = db;
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        lang TEXT,
        file_hash TEXT NOT NULL,
        last_seen TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS symbols (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        start_line INTEGER,
        end_line INTEGER,
        signature TEXT,
        FOREIGN KEY (file_id) REFERENCES files(id)
      );
      CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
      CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
    `);
  }

  async index(path: string, content: string): Promise<void> {
    const fileHash = createHash("sha256").update(content).digest("hex");
    const fileId = createHash("sha256").update(path).digest("hex");
    const lang = this.detectLang(path);

    const insertFile = this.db.prepare(`
      INSERT OR REPLACE INTO files (id, path, lang, file_hash, last_seen)
      VALUES (?, ?, ?, ?, ?)
    `);

    const deleteSymbols = this.db.prepare("DELETE FROM symbols WHERE file_id = ?");
    const insertSymbol = this.db.prepare(`
      INSERT INTO symbols (id, file_id, kind, name, start_line, end_line, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      insertFile.run(fileId, path, lang, fileHash, new Date().toISOString());
      deleteSymbols.run(fileId);
    });

    tx();

    try {
      const parser = await loadParser(lang);
      const symbols = extractSymbolsFromParser(parser, content, lang);
      
      const insertSymbolTx = this.db.transaction(() => {
        for (const sym of symbols) {
          const symId = createHash("sha256").update(`${fileId}:${sym.name}`).digest("hex");
          insertSymbol.run(symId, fileId, sym.kind, sym.name, sym.startLine, sym.endLine, sym.signature);
        }
      });
      insertSymbolTx();
    } catch {
      // Fall back to regex-based extraction if tree-sitter fails
      const symbols = this.extractSymbolsRegex(content, lang);
      const insertSymbolTx = this.db.transaction(() => {
        for (const sym of symbols) {
          const symId = createHash("sha256").update(`${fileId}:${sym.name}`).digest("hex");
          insertSymbol.run(symId, fileId, sym.kind, sym.name, sym.startLine, sym.endLine, sym.signature);
        }
      });
      insertSymbolTx();
    }
  }

  async query(q: string, topK = 5): Promise<CodeResult[]> {
    const rows = this.db.prepare("SELECT * FROM symbols").all() as any[];
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = rows
      .map(row => {
        const haystack = `${row.name} ${row.signature || ""}`.toLowerCase();
        const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
        return {
          id: row.id,
          path: row.path,
          kind: row.kind,
          name: row.name,
          score,
        } satisfies CodeResult;
      })
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored;
  }

  private detectLang(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    const map: Record<string, string> = {
      ts: "typescript",
      js: "javascript",
      tsx: "tsx",
      py: "python",
      rs: "rust",
      go: "go",
      java: "java",
      kt: "kotlin",
      rb: "ruby",
      php: "php",
      cs: "csharp",
      cpp: "cpp",
      c: "c",
      swift: "swift",
      scala: "scala",
      ex: "elixir",
      html: "html",
      css: "css",
      json: "json",
      yaml: "yaml",
      yml: "yaml",
    };
    return map[ext] || "unknown";
  }

  private extractSymbolsRegex(
    content: string,
    lang: string,
  ): Array<{ kind: string; name: string; startLine: number; endLine: number; signature: string }> {
    const symbols: Array<{ kind: string; name: string; startLine: number; endLine: number; signature: string }> = [];
    const lines = content.split("\n");

    if (lang === "typescript" || lang === "javascript" || lang === "tsx") {
      const fnRegex = /^\s*(export\s+)?(async\s+)?function\s+(\w+)|^\s*const\s+(\w+)\s*=|^\s*class\s+(\w+)/;
      lines.forEach((line, idx) => {
        const match = line.match(fnRegex);
        if (match) {
          const name = match[3] || match[4] || match[5] || "unknown";
          symbols.push({
            kind: line.includes("class") ? "class" : "function",
            name,
            startLine: idx + 1,
            endLine: idx + 1,
            signature: line.trim(),
          });
        }
      });
    } else if (lang === "python") {
      const fnRegex = /^\s*(def|class)\s+(\w+)/;
      lines.forEach((line, idx) => {
        const match = line.match(fnRegex);
        if (match) {
          symbols.push({
            kind: match[1] === "class" ? "class" : "function",
            name: match[2]!,
            startLine: idx + 1,
            endLine: idx + 1,
            signature: line.trim(),
          });
        }
      });
    }

    return symbols;
  }
}
