import Database from "better-sqlite3";

export interface HybridResult {
  id: string;
  doc_id: string;
  content: string;
  heading_path: string;
  score: number;
  scoreDense: number;
  scoreSparse: number;
}

/**
 * Reciprocal Rank Fusion (RRF) of dense (vec0) and sparse (FTS5 BM25) results.
 * k=60 is the standard default from Cormack et al. 2009.
 */
const RRF_K = 60;

export function hybridSearch(
  db: Database.Database,
  queryText: string,
  queryVec: Float32Array,
  topK: number = 5,
): HybridResult[] {
  const expand = topK * 3;

  // ---- Dense (vec0) ----
  let dense: { rowid: number; score: number }[] = [];
  try {
    dense = db
      .prepare(
        `SELECT rowid, vec_distance_cosine(embedding, ?) AS score
         FROM chunks_vec
         ORDER BY score ASC
         LIMIT ?`,
      )
      .all(Buffer.from(queryVec.buffer), expand) as any;
  } catch {
    const all = db.prepare(`SELECT rowid, embedding FROM chunks WHERE embedding IS NOT NULL`).all() as any[];
    dense = all
      .map((r: any) => ({
        rowid: r.rowid,
        score: 1 - cosineSim(queryVec, new Float32Array((r.embedding as Buffer).buffer)),
      }))
      .sort((a: any, b: any) => a.score - b.score)
      .slice(0, expand);
  }

  // ---- Sparse (FTS5 BM25) ----
  const ftsQuery = sanitizeFtsQuery(queryText);
  const sparse = db
    .prepare(
      `SELECT rowid, bm25(chunks_fts) AS score
       FROM chunks_fts
       WHERE chunks_fts MATCH ?
       ORDER BY score ASC
       LIMIT ?`,
    )
    .all(ftsQuery, expand) as { rowid: number; score: number }[];

  // ---- RRF fuse ----
  const rrf = new Map<number, { dense: number; sparse: number; fused: number }>();
  dense.forEach((d, i) => {
    const e = rrf.get(d.rowid) ?? { dense: 0, sparse: 0, fused: 0 };
    e.dense = 1 / (RRF_K + i + 1);
    e.fused += e.dense;
    rrf.set(d.rowid, e);
  });
  sparse.forEach((s, i) => {
    const e = rrf.get(s.rowid) ?? { dense: 0, sparse: 0, fused: 0 };
    e.sparse = 1 / (RRF_K + i + 1);
    e.fused += e.sparse;
    rrf.set(s.rowid, e);
  });

  const ranked = [...rrf.entries()].sort((a, b) => b[1].fused - a[1].fused).slice(0, topK);

  // ---- Hydrate ----
  const stmt = db.prepare(`SELECT id, doc_id, content, heading_path FROM chunks WHERE rowid = ?`);
  return ranked.map(([rowid, scores]) => {
    const c = stmt.get(rowid) as any;
    return {
      id: c.id,
      doc_id: c.doc_id,
      content: c.content,
      heading_path: c.heading_path,
      score: scores.fused,
      scoreDense: scores.dense,
      scoreSparse: scores.sparse,
    };
  });
}

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

function sanitizeFtsQuery(q: string): string {
  // FTS5 special chars must be quoted as phrases or escaped
  return q
    .replace(/["']/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t}"`)
    .join(" OR ");
}
