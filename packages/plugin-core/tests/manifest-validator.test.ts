// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { validateManifest, assertValidManifest } from "../src/manifest-validator";
import { ManifestInvalidError } from "../src/errors";

function makePackageJson(overrides: Record<string, unknown> = {}) {
  return {
    name: "@example/skill",
    version: "1.0.0",
    license: "Apache-2.0",
    main: "./dist/plugin.js",
    types: "./dist/plugin.d.ts",
    keywords: ["test"],
    orqenixPlugin: {
      manifestVersion: "1.0",
      kind: "skill",
      compatibility: { orqenix: ">=0.8.0" },
      permissions: ["scope.read"],
      external_agent_compat: ["claude-code"],
      tool: {
        name: "test_skill",
        description: "A test skill",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    },
    ...overrides,
  };
}

describe("Manifest Validator", () => {
  it("validates a well-formed plugin package.json", () => {
    const result = validateManifest(makePackageJson());
    expect(result.valid).toBe(true);
    expect(result.csf).toBeDefined();
    expect(result.csf?.name).toBe("@example/skill");
  });

  it("rejects non-object input", () => {
    const result = validateManifest("not an object");
    expect(result.valid).toBe(false);
  });

  it("rejects package.json without orqenixPlugin field", () => {
    const result = validateManifest({ name: "foo", version: "1.0.0" });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("missing orqenixPlugin");
  });

  it("rejects unsupported plugin kind", () => {
    const pkg = makePackageJson();
    (pkg.orqenixPlugin as Record<string, unknown>).kind = "not-real";
    const result = validateManifest(pkg);
    expect(result.valid).toBe(false);
  });

  it("infers typescript language from types field", () => {
    const result = validateManifest(makePackageJson());
    expect(result.csf?.implementation.language).toBe("typescript");
  });

  it("merges license from package.json into manifest", () => {
    const result = validateManifest(makePackageJson());
    expect(result.csf?.manifest.license).toBe("Apache-2.0");
  });

  it("surfaces kind-specific warnings (skill missing examples)", () => {
    const result = validateManifest(makePackageJson());
    expect(result.warnings?.some((w) => w.includes("examples"))).toBe(true);
  });

  it("blocks agent-binding with non-Apache-2.0 license (Anti-pattern 41)", () => {
    const pkg = makePackageJson({
      license: "MIT",
      orqenixPlugin: {
        manifestVersion: "1.0",
        kind: "agent-binding",
        compatibility: { orqenix: ">=0.8.0" },
        permissions: ["scope.read"],
        external_agent_compat: ["claude-code"],
        keywords: ["claude-code"],
      },
    });
    const result = validateManifest(pkg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Apache-2.0"))).toBe(true);
  });

  it("blocks subagent requesting memory.write (ADR-E-002)", () => {
    const pkg = makePackageJson({
      orqenixPlugin: {
        manifestVersion: "1.0",
        kind: "subagent",
        compatibility: { orqenix: ">=0.8.0" },
        permissions: ["memory.write:lesson"],
        external_agent_compat: ["claude-code"],
        tool: {
          name: "reviewer",
          description: "Reviews code",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
        },
      },
    });
    const result = validateManifest(pkg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("memory.write"))).toBe(true);
  });

  it("assertValidManifest throws on invalid input", () => {
    expect(() => assertValidManifest({ name: "foo" })).toThrow(ManifestInvalidError);
  });

  it("assertValidManifest returns CSF on valid input", () => {
    const csf = assertValidManifest(makePackageJson());
    expect(csf.kind).toBe("skill");
  });
});
