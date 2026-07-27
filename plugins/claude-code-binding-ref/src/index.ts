// SPDX-License-Identifier: Apache-2.0
// Reference agent-binding plugin: template for platform bindings.
//
// Demonstrates the agent-binding plugin kind per Anti-pattern 41:
//   - MUST be Apache-2.0 (no vendor lock-in)
//   - bridges Orqenix to a platform via its native mechanism
//   - declares target platform via keywords
//
// This reference shows the shape; the production claude-code binding lives in
// @orqenix/binding-claude-code (D8.α.7).

interface BindingActivateResult {
  ok: boolean;
  platform: string;
  configWritten: string;
}

/**
 * Activates the binding: writes platform config pointing to the Orqenix MCP
 * server. Reference returns the shape; production writes .mcp.json.
 */
export async function activate(input: { projectPath: string }): Promise<BindingActivateResult> {
  // Production: write `${projectPath}/.mcp.json` with mcpServers.orqenix
  return {
    ok: true,
    platform: "claude-code",
    configWritten: `${input.projectPath}/.mcp.json`,
  };
}

/** Deactivates: removes the Orqenix entry from platform config */
export async function deactivate(input: { projectPath: string }): Promise<{ ok: boolean }> {
  void input;
  return { ok: true };
}

/** The target platform this binding bridges to */
export const targetPlatform = "claude-code";
