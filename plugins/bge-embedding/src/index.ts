// SPDX-License-Identifier: Apache-2.0
// Reference embedding-model plugin: BGE-small-v1.5 local embeddings.
//
// Demonstrates the embedding-model plugin kind. For the reference, we provide a
// deterministic hash-based embedding stub; production swaps @xenova/transformers
// with the actual BGE model (offline, no network per local default).

interface EmbedInput {
  text: string;
}

interface EmbedOutput {
  embedding: number[];
  dimension: number;
}

const DIMENSION = 384;

export async function invoke(input: EmbedInput): Promise<EmbedOutput> {
  // Reference: deterministic pseudo-embedding from text.
  // Production: const { pipeline } = await import('@xenova/transformers');
  //             const embed = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
  const embedding = pseudoEmbed(input.text, DIMENSION);
  return { embedding, dimension: DIMENSION };
}

function pseudoEmbed(text: string, dim: number): number[] {
  const vec = new Array<number>(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    vec[code % dim] = (vec[code % dim]! + 1) / (i + 1);
  }
  // Normalize
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}
