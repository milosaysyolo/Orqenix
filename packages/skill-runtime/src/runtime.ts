// SPDX-License-Identifier: Apache-2.0
// @orqenix/skill-runtime , Skill runtime
//
// Executes CSF skills. Resolves an installed skill by name, validates input
// against its declared inputSchema, runs it in the plugin sandbox, validates
// output against outputSchema. Per CR v8.0 Chapter 9.

import type { MemoryEngine } from "@orqenix/memory-engine";
import {
  SandboxManager,
  PluginRegistry,
  type CanonicalSkillFormat,
  type RegisteredPlugin,
} from "@orqenix/plugin-core";

export interface SkillRuntimeOptions {
  engine: MemoryEngine;
  /** Optional sandbox manager override (default constructs one) */
  sandboxManager?: SandboxManager;
  /** Optional plugin registry override */
  registry?: PluginRegistry;
}

export interface SkillInvocationContext {
  sessionId?: string;
  branchId?: string;
  clientId: string;
  /** Optional trace ID for audit */
  traceId?: string;
}

export interface SkillInvocationResult {
  output: unknown;
  durationMs: number;
  /** Whether output validated against the skill's outputSchema */
  outputValid: boolean;
}

export class SkillNotFoundError extends Error {
  constructor(skillName: string) {
    super(`Skill '${skillName}' is not installed or not active`);
    this.name = "SkillNotFoundError";
    Object.setPrototypeOf(this, SkillNotFoundError.prototype);
  }
}

export class SkillInputInvalidError extends Error {
  constructor(skillName: string, issues: string[]) {
    super(`Skill '${skillName}' input invalid: ${issues.join("; ")}`);
    this.name = "SkillInputInvalidError";
    Object.setPrototypeOf(this, SkillInputInvalidError.prototype);
  }
}

/**
 * SkillRuntime executes CSF skills via the plugin sandbox (D8.α.4).
 *
 * Flow:
 *   1. Resolve skill by name from PluginRegistry (kind === 'skill')
 *   2. Validate input against the skill's inputSchema
 *   3. Activate the sandbox if not already active
 *   4. Invoke the tool via SandboxManager
 *   5. Validate output against outputSchema (advisory)
 */
export class SkillRuntime {
  private readonly sandbox: SandboxManager;
  private readonly registry: PluginRegistry;

  constructor(options: SkillRuntimeOptions) {
    this.sandbox = options.sandboxManager ?? new SandboxManager();
    this.registry = options.registry ?? new PluginRegistry();
  }

  /**
   * Invokes a skill by name.
   */
  async invoke(
    skillName: string,
    input: unknown,
    ctx: SkillInvocationContext,
  ): Promise<SkillInvocationResult> {
    const startMs = Date.now();

    // 1. Resolve skill
    const plugin = this.registry.find(skillName);
    if (!plugin || plugin.csf.kind !== "skill") {
      throw new SkillNotFoundError(skillName);
    }

    // 2. Validate input against inputSchema (best-effort structural check)
    const inputIssues = this.validateInput(plugin.csf, input);
    if (inputIssues.length > 0) {
      throw new SkillInputInvalidError(skillName, inputIssues);
    }

    // 3. Activate sandbox if needed
    if (!this.sandbox.isActive(skillName)) {
      await this.sandbox.activate(plugin, this.resolveEntryPath(plugin));
    }

    // 4. Invoke via sandbox
    const toolName = plugin.csf.manifest.tool?.name ?? skillName;
    const result = await this.sandbox.invoke({
      pluginName: skillName,
      toolName,
      input,
      ...(ctx.traceId ? { traceId: ctx.traceId } : {}),
    });

    await this.registry.recordInvocation(skillName, true);

    // 5. Validate output (advisory; doesn't throw)
    const outputValid = this.validateOutput(plugin.csf, result.output);

    return {
      output: result.output,
      durationMs: Date.now() - startMs,
      outputValid,
    };
  }

  /** Lists installed skills */
  listSkills(): RegisteredPlugin[] {
    return this.registry.listByKind("skill");
  }

  // ─── Private ────────────────────────────────────────────────────────

  private resolveEntryPath(plugin: RegisteredPlugin): string {
    const { join, isAbsolute } = require("node:path") as typeof import("node:path");
    const entry = plugin.csf.implementation.entry;
    return isAbsolute(entry) ? entry : join(plugin.packagePath, entry);
  }

  private validateInput(csf: CanonicalSkillFormat, input: unknown): string[] {
    const issues: string[] = [];
    const schema = csf.manifest.tool?.inputSchema as
      | { required?: string[]; properties?: Record<string, unknown> }
      | undefined;
    if (!schema) return issues;

    // Structural check: required fields present
    if (schema.required && Array.isArray(schema.required)) {
      const obj = (input ?? {}) as Record<string, unknown>;
      for (const req of schema.required) {
        if (!(req in obj)) {
          issues.push(`Missing required input field: ${req}`);
        }
      }
    }
    return issues;
  }

  private validateOutput(csf: CanonicalSkillFormat, output: unknown): boolean {
    const schema = csf.manifest.tool?.outputSchema as { required?: string[] } | undefined;
    if (!schema) return true; // no output schema declared
    if (schema.required && Array.isArray(schema.required)) {
      const obj = (output ?? {}) as Record<string, unknown>;
      return schema.required.every((req) => req in obj);
    }
    return true;
  }
}
