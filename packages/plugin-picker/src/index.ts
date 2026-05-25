import type { OrqenixPlugin } from "@orqenix/core/plugin";

export interface PickerConfig {
  enabled: boolean;
  topN: number;
  minScore: number;
  diversity: boolean;
  lambda: number;
}

const DEFAULT_CONFIG: PickerConfig = {
  enabled: true,
  topN: 5,
  minScore: 0.3,
  diversity: true,
  lambda: 0.5,
};

export interface ScoredCandidate<T = unknown> {
  item: T;
  score: number;
  vector?: number[];
  text?: string;
}

export function pickTopN<T>(
  candidates: ScoredCandidate<T>[],
  config: PickerConfig,
): ScoredCandidate<T>[] {
  const filtered = candidates.filter((c) => c.score >= config.minScore);
  if (filtered.length === 0) return [];

  if (!config.diversity) {
    return filtered.sort((a, b) => b.score - a.score).slice(0, config.topN);
  }

  return mmrSelect(filtered, config.topN, config.lambda);
}

function mmrSelect<T>(
  candidates: ScoredCandidate<T>[],
  k: number,
  lambda: number,
): ScoredCandidate<T>[] {
  const selected: ScoredCandidate<T>[] = [];
  const remaining = [...candidates].sort((a, b) => b.score - a.score);

  if (remaining.length === 0) return selected;
  selected.push(remaining.shift()!);

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]!;
      const maxSimToSelected = Math.max(...selected.map((s) => similarity(candidate, s)));
      const mmrScore = lambda * candidate.score - (1 - lambda) * maxSimToSelected;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]!);
  }

  return selected;
}

function similarity<T>(a: ScoredCandidate<T>, b: ScoredCandidate<T>): number {
  if (a.vector && b.vector) return cosineSimilarity(a.vector, b.vector);
  if (a.text && b.text) return jaccardTextSimilarity(a.text, b.text);
  return 0;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function jaccardTextSimilarity(a: string, b: string): number {
  const tokensA = new Set(
    a
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
  const tokensB = new Set(
    b
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  if (union === 0) return 0;
  return intersection / union;
}

export function createPlugin(userConfig: Partial<PickerConfig> = {}): OrqenixPlugin {
  const config: PickerConfig = { ...DEFAULT_CONFIG, ...userConfig };

  return {
    name: "picker",
    version: "0.3.0-dev",
    description: "Top-N selection with MMR diversity",
    priority: 90,
    capabilities: ["selection", "ranking"],
    hooks: {
      "knowledge.query": async (query, _ctx) => {
        const adjustedTopK = Math.min(query.topK ?? config.topN, config.topN);
        return { ...query, topK: adjustedTopK };
      },
    },
  };
}

export const plugin = createPlugin();
export default plugin;
