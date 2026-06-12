// SPDX-License-Identifier: Apache-2.0
// Reference memory-injection-strategy plugin: token-budget windowed selection.
//
// Demonstrates hierarchy-aware injection: greedily select highest-ranked entries
// until the token budget is exhausted. Subagent returns (high boost) come first.

interface RankedEntry {
  id: string;
  content: string;
  score: number;
  isSubagentReturn?: boolean;
}

interface InjectInput {
  ranked: RankedEntry[];
  tokenBudget: number;
}

interface InjectOutput {
  selected: Array<{ id: string; content: string }>;
  tokensUsed: number;
}

export async function invoke(input: InjectInput): Promise<InjectOutput> {
  // Subagent returns are hard-includes (always first), then by score
  const sorted = [...input.ranked].sort((a, b) => {
    if (a.isSubagentReturn !== b.isSubagentReturn) return a.isSubagentReturn ? -1 : 1;
    return b.score - a.score;
  });

  const selected: Array<{ id: string; content: string }> = [];
  let tokensUsed = 0;

  for (const entry of sorted) {
    const tokens = estimateTokens(entry.content);
    // Hard-include subagent returns even if over budget
    if (entry.isSubagentReturn || tokensUsed + tokens <= input.tokenBudget) {
      selected.push({ id: entry.id, content: entry.content });
      tokensUsed += tokens;
    }
  }

  return { selected, tokensUsed };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4); // ~4 chars per token heuristic
}
