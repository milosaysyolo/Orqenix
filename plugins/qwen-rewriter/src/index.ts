// SPDX-License-Identifier: Apache-2.0
// Reference prompt-rewriter plugin: Qwen 2.5 7B local rewriting.
//
// Reference implements a rule-based rewrite; production loads Qwen 2.5 7B
// locally (default per Phase 4) or BYOK alternative.

interface RewriteInput {
  prompt: string;
}

interface RewriteOutput {
  rewritten: string;
}

export async function invoke(input: RewriteInput): Promise<RewriteOutput> {
  // Reference: expand abbreviations + add retrieval-friendly keywords.
  // Production: const model = await loadQwen('qwen2.5-7b-instruct');
  let rewritten = input.prompt.trim();
  // Expand common dev abbreviations to improve retrieval
  const expansions: Record<string, string> = {
    '\\bfn\\b': 'function',
    '\\bcfg\\b': 'configuration',
    '\\bdb\\b': 'database',
    '\\bauth\\b': 'authentication',
  };
  for (const [pattern, full] of Object.entries(expansions)) {
    rewritten = rewritten.replace(new RegExp(pattern, 'gi'), full);
  }
  return { rewritten };
}
