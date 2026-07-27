// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import {
  ALL_OUTPUT_ADAPTERS,
  npmOutputAdapter,
  cursorOutputAdapter,
  claudeCodeOutputAdapter,
} from "../src/index";
import { buildCsf } from "@orqenix/normalization-engine";
import type { CanonicalSkillFormat } from "@orqenix/plugin-core";

function freshCsf(): CanonicalSkillFormat {
  return buildCsf({
    name: "@example/skill",
    version: "1.0.0",
    kind: "skill",
    tool: {
      name: "do_thing",
      description: "Does a thing",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
    },
    permissions: ["scope.read", "git.write"],
    external_agent_compat: ["claude-code", "cursor"],
    license: "Apache-2.0",
    importedFromKind: "manual",
    normalizerVersion: "1.0.0",
    originalFormatPreserved: {},
  });
}

describe("Output adapters", () => {
  it("exports exactly 8 adapters", () => {
    expect(ALL_OUTPUT_ADAPTERS).toHaveLength(8);
  });

  it("all adapters have unique kinds", () => {
    const kinds = ALL_OUTPUT_ADAPTERS.map((a) => a.kind);
    expect(new Set(kinds).size).toBe(8);
  });

  it("npm export is never lossy (canonical mapping)", () => {
    const report = npmOutputAdapter.validateExportability(freshCsf());
    expect(report.lossyFields).toEqual([]);
  });

  it("npm serializes valid package.json with orqenixPlugin", async () => {
    const result = await npmOutputAdapter.serialize(freshCsf());
    const pkg = JSON.parse(result.content) as { orqenixPlugin: { kind: string } };
    expect(pkg.orqenixPlugin.kind).toBe("skill");
    expect(result.suggestedPath).toBe("package.json");
  });

  it("cursor export is lossy for structured fields", () => {
    const report = cursorOutputAdapter.validateExportability(freshCsf());
    expect(report.lossyFields.length).toBeGreaterThan(0);
    expect(report.lossyFields).toContain("permissions");
  });

  it("claude-code export not lossy when round-trip from claude-code", () => {
    const csf = buildCsf({
      name: "@local/git",
      version: "1.0.0",
      kind: "skill",
      importedFromKind: "claude-code",
      normalizerVersion: "1.0.0",
      originalFormatPreserved: { frontmatter: {}, body: "x", raw: "---\nskill: git\n---\nx" },
    });
    const report = claudeCodeOutputAdapter.validateExportability(csf);
    expect(report.lossyFields).toEqual([]);
  });

  it("claude-code reconstructs raw markdown on round-trip", async () => {
    const raw = "---\nskill: git\ndescription: helper\n---\n# Git\nrun it";
    const csf = buildCsf({
      name: "@local/git",
      version: "1.0.0",
      kind: "skill",
      importedFromKind: "claude-code",
      normalizerVersion: "1.0.0",
      originalFormatPreserved: { frontmatter: { skill: "git" }, body: "# Git\nrun it", raw },
    });
    const result = await claudeCodeOutputAdapter.serialize(csf);
    expect(result.content).toBe(raw); // byte-identical
  });
});
