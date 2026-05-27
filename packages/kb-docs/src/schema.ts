import Database from "better-sqlite3";

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id          TEXT PRIMARY KEY,
      path        TEXT NOT NULL,
      format      TEXT NOT NULL,
      file_hash   TEXT NOT NULL,
      indexed_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id              TEXT PRIMARY KEY,
      doc_id          TEXT NOT NULL,
      heading_path    TEXT NOT NULL,
      content         TEXT NOT NULL,
      start_line      INTEGER,
      end_line        INTEGER,
      embedding       BLOB,
      FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);

    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      content,
      content='chunks',
      content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
      INSERT INTO chunks_fts(rowid, content) VALUES (new.rowid, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.rowid, old.content);
    END;
  `);

  try {
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(embedding float[384])`);
  } catch {
    // vec0 extension not available; hybrid search uses in-memory cosine sim fallback
  }
}
