// SPDX-License-Identifier: Apache-2.0
// Reference skill plugin: Conventional Commits message generator.
//
// Demonstrates the skill plugin kind: atomic, stateless, MCP-tool-compatible,
// works across all 7 agent platforms (external_agent_compat).

interface CommitInput {
  type: "feat" | "fix" | "docs" | "style" | "refactor" | "test" | "chore";
  scope?: string;
  description: string;
  body?: string;
  breakingChange?: boolean;
}

interface CommitOutput {
  message: string;
}

/**
 * Generates a Conventional Commits message. Pure function: deterministic,
 * no side effects in the reference (production would invoke `git commit`).
 */
export async function invoke(input: CommitInput): Promise<CommitOutput> {
  const scope = input.scope ? `(${input.scope})` : "";
  const breaking = input.breakingChange ? "!" : "";
  let message = `${input.type}${scope}${breaking}: ${input.description}`;

  if (input.body) {
    message += `\n\n${input.body}`;
  }

  if (input.breakingChange) {
    message += `\n\nBREAKING CHANGE: ${input.description}`;
  }

  return { message };
}
