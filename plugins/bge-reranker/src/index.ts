// SPDX-License-Identifier: Apache-2.0
// Reference reranker plugin: keyword-overlap reranking (BGE in production).

interface RerankInput {
  query: string;
  candidates: Array<{ id: string; text: string }>;
}

interface RerankOutput {
  ranked: Array<{ id: string; score: number }>;
}

export async function invoke(input: RerankInput): Promise<RerankOutput> {
  const queryTerms = new Set(input.query.toLowerCase().split(/\s+/));
  const ranked = input.candidates
    .map((c) => {
      const candTerms = c.text.toLowerCase().split(/\s+/);
      const overlap = candTerms.filter((t) => queryTerms.has(t)).length;
      const score = candTerms.length > 0 ? overlap / candTerms.length : 0;
      return { id: c.id, score };
    })
    .sort((a, b) => b.score - a.score);
  return { ranked };
}
