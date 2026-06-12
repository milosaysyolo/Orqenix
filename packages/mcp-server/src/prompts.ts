// SPDX-License-Identifier: Apache-2.0
// @orqenix/mcp-server , Prompt definitions
//
// 6 MCP prompts (templated instructions) per CR v8.0 Section 9.2.3.
// Agents fill in context-specific values via {{placeholders}}.

export interface McpPromptDefinition {
  name: string;
  description: string;
  /** Declared arguments the prompt accepts */
  arguments: Array<{ name: string; description: string; required: boolean }>;
  /** Renders the prompt with provided arguments */
  render(args: Record<string, unknown>): string;
}

function fill(template: string, args: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const v = args[key];
    return v !== undefined ? String(v) : `{{${key}}}`;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Prompt 1: decision template
// ─────────────────────────────────────────────────────────────────────────

const decisionTemplate: McpPromptDefinition = {
  name: 'orqenix_decision_template',
  description: 'Helps agents create well-structured architectural decisions.',
  arguments: [
    { name: 'topic', description: 'The decision topic', required: true },
  ],
  render(args) {
    return fill(
      `Record an architectural decision about: {{topic}}

Structure your decision with:
1. **Title**: A short, descriptive title
2. **Context**: What problem or situation prompted this decision?
3. **Decision**: What did you decide?
4. **Rationale**: Why this choice over alternatives?
5. **Alternatives considered**: What else did you evaluate?
6. **Consequences**: What are the trade-offs?

Then call orqenix_record_decision with the title, rationale, and alternatives.`,
      args
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Prompt 2: lesson template
// ─────────────────────────────────────────────────────────────────────────

const lessonTemplate: McpPromptDefinition = {
  name: 'orqenix_lesson_template',
  description: 'Helps agents capture lessons learned consistently.',
  arguments: [
    { name: 'incident', description: 'What happened', required: false },
  ],
  render(args) {
    return fill(
      `Capture a lesson learned{{incident}}.

Structure your lesson with:
1. **Title**: A memorable, searchable title
2. **Context**: What were you doing when this came up?
3. **Lesson**: The key insight, expressed so future-you can apply it
4. **References**: Links to commits, issues, docs that illustrate it

Then call orqenix_record_lesson with the title, context, lesson, and references.`,
      args
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Prompt 3: code review template
// ─────────────────────────────────────────────────────────────────────────

const reviewTemplate: McpPromptDefinition = {
  name: 'orqenix_review_template',
  description: 'Code review prompt enriched with Orqenix decision + lesson context.',
  arguments: [
    { name: 'files', description: 'Files under review', required: true },
  ],
  render(args) {
    return fill(
      `Review the following files: {{files}}

Before reviewing, call orqenix_recall_memory with kbs=["decision","lesson"] to
retrieve relevant architectural decisions and past lessons. Apply them to the review.

Focus on:
- Consistency with recorded architectural decisions
- Avoidance of previously-recorded mistakes (lessons)
- Correctness, readability, test coverage
- Security + performance implications

After review, if you discover a reusable insight, call orqenix_record_lesson.`,
      args
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Prompt 4: summarize session
// ─────────────────────────────────────────────────────────────────────────

const summarizeSession: McpPromptDefinition = {
  name: 'orqenix_summarize_session',
  description: 'Session summary at conclusion, for promotion to branch memory.',
  arguments: [],
  render(args) {
    return fill(
      `Summarize this working session.

Produce:
1. **What was accomplished**: Concrete outcomes
2. **Decisions made**: Call orqenix_record_decision for each
3. **Lessons learned**: Call orqenix_record_lesson for each
4. **Open items**: What remains for next session

For high-value decisions + lessons, consider orqenix_promote_to_branch so other
sessions on this branch can reuse them.`,
      args
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Prompt 5: pre-commit
// ─────────────────────────────────────────────────────────────────────────

const preCommit: McpPromptDefinition = {
  name: 'orqenix_pre_commit',
  description: 'Pre-commit hook prompt with Orqenix context.',
  arguments: [
    { name: 'diff', description: 'The staged diff', required: false },
  ],
  render(args) {
    return fill(
      `Before committing{{diff}}, run through this checklist:

1. Call orqenix_recall_memory kbs=["decision"] to confirm the change aligns
   with recorded architectural decisions.
2. Call orqenix_recall_memory kbs=["lesson"] to ensure you are not repeating
   a previously-recorded mistake.
3. Verify tests pass.
4. Write a Conventional Commits message (feat/fix/docs/refactor/test/chore).

If this commit embodies a new decision, call orqenix_record_decision first.`,
      args
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Prompt 6: post test failure
// ─────────────────────────────────────────────────────────────────────────

const postTestFailure: McpPromptDefinition = {
  name: 'orqenix_post_test_failure',
  description: 'After a test failure, capture the lesson.',
  arguments: [
    { name: 'failure', description: 'The failure details', required: true },
  ],
  render(args) {
    return fill(
      `A test just failed: {{failure}}

After you fix it:
1. Call orqenix_recall_memory kbs=["lesson"] to check if this is a recurring
   class of failure.
2. Once fixed, call orqenix_record_lesson capturing:
   - The root cause
   - The fix
   - How to prevent recurrence

This builds the project's institutional memory of failure modes.`,
      args
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Aggregate: all 6 prompts
// ─────────────────────────────────────────────────────────────────────────

export const ALL_PROMPTS: McpPromptDefinition[] = [
  decisionTemplate,
  lessonTemplate,
  reviewTemplate,
  summarizeSession,
  preCommit,
  postTestFailure,
];

export function getPrompt(name: string): McpPromptDefinition | undefined {
  return ALL_PROMPTS.find((p) => p.name === name);
}
