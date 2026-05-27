import type { HybridHit } from "./types.js";

export interface GraderConfig {
  minScore: number;
  diversityPenalty: number;
}

export function gradeAndDiversify(
  hits: HybridHit[],
  config: GraderConfig = { minScore: 0.1, diversityPenalty: 0.2 }
): HybridHit[] {
  const filtered = hits.filter((h) => h.score >= config.minScore);
  const seenPaths = new Set<string>();
  const out: HybridHit[] = [];
  for (const h of filtered) {
    const dir = h.path.split("/").slice(0, -1).join("/");
    if (seenPaths.has(dir)) {
      out.push({ ...h, score: h.score * (1 - config.diversityPenalty) });
    } else {
      out.push(h);
      seenPaths.add(dir);
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
