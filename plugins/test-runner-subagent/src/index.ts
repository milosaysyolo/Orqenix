// SPDX-License-Identifier: Apache-2.0
// Reference subagent plugin: test-runner.
//
// Demonstrates the subagent plugin kind per ADR-E-002:
//   - NO matrix, NO persistence (no memory.write permission)
//   - ephemeral: parent injects context, subagent returns + terminates
//   - declares outputSchema (parent absorbs the return to T1+T2)
//   - cannot spawn sub-subagents (Anti-pattern 36)

interface RunTestsInput {
  testPath?: string;
}

interface TestFailure {
  test: string;
  error: string;
}

interface RunTestsOutput {
  passed: number;
  failed: number;
  failures: TestFailure[];
}

/**
 * Subagent invoke. Receives parent-injected harness (goal + scoped context +
 * constraints). Runs tests, returns a structured result conforming to
 * outputSchema. The parent absorbs this return into its T1+T2 memory.
 */
export async function invoke(input: RunTestsInput): Promise<RunTestsOutput> {
  // Reference returns a canned result; production runs the actual test command
  // within the sandbox's command.execute:limited allowlist.
  const path = input.testPath ?? ".";
  void path;

  // Production: spawn `npm test` / `pytest` and parse output.
  return {
    passed: 142,
    failed: 0,
    failures: [],
  };
}
