import type { FtsHit, HybridHit, VecHit, EmbeddingProvider } from "./types.js";
import type { KbDocsHandle } from "./db.js";

export interface HybridRetrievalOptions {
  alpha?: number;
  ftsLimit?: number;
  vecLimit?: number;
  finalLimit?: number;
}

export interface HybridSearchInput {
  text: string;
  embedding?: Float32Array;
}

function normalize(values: number[], invert: boolean): Map<number, number> {
  const out = new Map<number, number>();
  if (values.length === 0) return out;
  const min = Math.min(...values);
  const max = Math.max(...values);
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    const range = max - min;
    let n = range === 0 ? 1 : (v - min) / range;
    if (invert) n = 1 - n;
    out.set(i, n);
  }
  return out;
}

export function hybridRank(
  ftsHits: FtsHit[],
  vecHits: VecHit[],
  alpha: number = 0.6
): HybridHit[] {
  const ftsRanks = ftsHits.map((h) => h.rank);
  const ftsNorm = normalize(ftsRanks, true);

  const vecDistances = vecHits.map((h) => h.distance);
  const vecNorm = normalize(vecDistances, true);

  const scores = new Map<string, HybridHit>();

  ftsHits.forEach((h, i) => {
    const n = ftsNorm.get(i) ?? 0;
    scores.set(h.id, {
      id: h.id,
      path: h.path,
      title: h.title,
      score: n * (1 - alpha),
      source: "fts",
    });
  });

  vecHits.forEach((h, i) => {
    const n = vecNorm.get(i) ?? 0;
    const prev = scores.get(h.id);
    if (prev) {
      scores.set(h.id, {
        ...prev,
        score: prev.score + n * alpha,
        source: "both",
      });
    } else {
      scores.set(h.id, {
        id: h.id,
        path: "",
        title: "",
        score: n * alpha,
        source: "vec",
      });
    }
  });

  return [...scores.values()].sort((a, b) => b.score - a.score);
}

export async function hybridSearch(
  handle: KbDocsHandle,
  input: HybridSearchInput,
  embedder: EmbeddingProvider | undefined,
  opts: HybridRetrievalOptions = {}
): Promise<HybridHit[]> {
  const alpha = opts.alpha ?? 0.6;
  const ftsLimit = opts.ftsLimit ?? 20;
  const vecLimit = opts.vecLimit ?? 20;
  const finalLimit = opts.finalLimit ?? 10;

  const ftsHits = handle.searchText(input.text, ftsLimit);

  let vecHits: VecHit[] = [];
  if (embedder) {
    const embedding = input.embedding ?? (await embedder.embed(input.text));
    vecHits = handle.searchVec(embedding, vecLimit);
  }

  return hybridRank(ftsHits, vecHits, alpha).slice(0, finalLimit);
}
