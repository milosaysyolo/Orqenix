export interface DocRecord {
  id: string;
  path: string;
  title: string;
  content: string;
  updatedAt: number;
}

export interface FtsHit {
  id: string;
  path: string;
  title: string;
  snippet: string;
  rank: number;
}

export interface VecHit {
  id: string;
  distance: number;
}

export interface HybridHit {
  id: string;
  path: string;
  title: string;
  score: number;
  source: "fts" | "vec" | "both";
}

export interface EmbeddingProvider {
  dimension: number;
  embed(text: string): Promise<Float32Array>;
}

export interface DocQueryResult {
  id: string;
  text: string;
  score: number;
  path: string;
  heading: string;
}
