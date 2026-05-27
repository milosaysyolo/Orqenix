import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import type { DocRecord, FtsHit, VecHit, DocQueryResult } from "./types.js";

export interface KbDocsHandle {
  insertDoc(doc: DocRecord, embedding?: Float32Array): void;
  deleteDoc(id: string): void;
  searchText(query: string, limit?: number): FtsHit[];
  searchVec(embedding: Float32Array, limit?: number): VecHit[];
  query(query: string, topK?: number): DocQueryResult[];
  count(): number;
  close(): void;
  raw(): Database.Database;
}

export function openKbDocs(path: string, dimension: number = 1536): KbDocsHandle {
  const db = new Database(path);
  sqliteVec.load(db);

  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
      id UNINDEXED,
      path UNINDEXED,
      title,
      content,
      tokenize = 'porter unicode61'
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS docs_vec USING vec0(
      id TEXT PRIMARY KEY,
      embedding float[${dimension}]
    );
  `);

  const insertDocStmt = db.prepare(
    "INSERT OR REPLACE INTO docs (id, path, title, content, updated_at) VALUES (?, ?, ?, ?, ?)"
  );
  const insertFtsStmt = db.prepare(
    "INSERT INTO docs_fts (id, path, title, content) VALUES (?, ?, ?, ?)"
  );
  const deleteFtsStmt = db.prepare("DELETE FROM docs_fts WHERE id = ?");
  const insertVecStmt = db.prepare(
    "INSERT INTO docs_vec (id, embedding) VALUES (?, ?)"
  );
  const deleteVecStmt = db.prepare("DELETE FROM docs_vec WHERE id = ?");
  const deleteDocStmt = db.prepare("DELETE FROM docs WHERE id = ?");

  return {
    insertDoc(doc, embedding) {
      const tx = db.transaction(() => {
        insertDocStmt.run(doc.id, doc.path, doc.title, doc.content, doc.updatedAt);
        deleteFtsStmt.run(doc.id);
        insertFtsStmt.run(doc.id, doc.path, doc.title, doc.content);
        if (embedding) {
          deleteVecStmt.run(doc.id);
          insertVecStmt.run(doc.id, Buffer.from(embedding.buffer));
        }
      });
      tx();
    },

    deleteDoc(id) {
      const tx = db.transaction(() => {
        deleteDocStmt.run(id);
        deleteFtsStmt.run(id);
        deleteVecStmt.run(id);
      });
      tx();
    },

    searchText(query, limit = 10) {
      const rows = db
        .prepare(
          `SELECT id, path, title, snippet(docs_fts, 3, '<b>', '</b>', '...', 16) AS snippet, rank
           FROM docs_fts WHERE docs_fts MATCH ? ORDER BY rank LIMIT ?`
        )
        .all(query, limit) as FtsHit[];
      return rows;
    },

    searchVec(embedding, limit = 10) {
      const rows = db
        .prepare(
          `SELECT id, distance FROM docs_vec
           WHERE embedding MATCH ? ORDER BY distance LIMIT ?`
        )
        .all(Buffer.from(embedding.buffer), limit) as VecHit[];
      return rows;
    },

    query(queryStr, topK = 10) {
      const hits = db
        .prepare(
          `SELECT d.id, d.path, d.title,
                  snippet(docs_fts, 3, '<b>', '</b>', '...', 16) AS snippet, rank
           FROM docs_fts JOIN docs d ON d.id = docs_fts.id
           WHERE docs_fts MATCH ? ORDER BY rank LIMIT ?`
        )
        .all(queryStr, topK) as Array<FtsHit>;
      return hits.map((h) => ({
        id: h.id,
        text: h.snippet,
        score: Math.max(0, 1 - h.rank / 100),
        path: h.path,
        heading: h.title,
      }));
    },

    count() {
      const r = db.prepare("SELECT COUNT(*) as c FROM docs").get() as { c: number };
      return r.c;
    },

    close() {
      db.close();
    },

    raw() {
      return db;
    },
  };
}
