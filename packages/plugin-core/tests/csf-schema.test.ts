// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import {
  CanonicalSkillFormatSchema,
  PluginKindSchema,
  ALL_PLUGIN_KINDS,
  KNOWLEDGE_KINDS,
  AGENT_KINDS,
} from "../src/csf-schema";

function makeValidCsf(overrides: Record<string, unknown> = {}) {
  return {
    name: "@example/git-commit",
    version: "1.0.0",
    kind: "skill",
    manifestVersion: "1.0",
    manifest: {
      tool: {
        name: "git_commit",
        description: "Creates a commit",
        inputSchema: { type: "object" },
      },
      permissions: ["scope.read", "git.write"],
      external_agent_compat: ["claude-code", "cursor"],
      license: "Apache-2.0",
      keywords: ["git"],
      compatibility: { orqenix: ">=0.8.0" },
    },
    implementation: {
      language: "typescript",
      entry: "./dist/plugin.js",
    },
    provenance: {
      verification_status: "unverified",
      contentHash: "abc123def456abc1abc123def456abc1",
    },
    ...overrides,
  };
}

describe("CSF Schema", () => {
  it("declares exactly 14 plugin kinds (ADR-E-006)", () => {
    expect(ALL_PLUGIN_KINDS).toHaveLength(14);
    expect(KNOWLEDGE_KINDS).toHaveLength(9);
    expect(AGENT_KINDS).toHaveLength(5);
  });

  it("knowledge + agent kinds are disjoint and cover all 14", () => {
    const combined = new Set([...KNOWLEDGE_KINDS, ...AGENT_KINDS]);
    expect(combined.size).toBe(14);
    for (const k of ALL_PLUGIN_KINDS) {
      expect(combined.has(k)).toBe(true);
    }
  });

  it("accepts all 14 valid kinds", () => {
    for (const kind of ALL_PLUGIN_KINDS) {
      expect(PluginKindSchema.safeParse(kind).success).toBe(true);
    }
  });

  it("rejects an unknown kind", () => {
    expect(PluginKindSchema.safeParse("unknown-kind").success).toBe(false);
  });

  it("validates a well-formed CSF", () => {
    const result = CanonicalSkillFormatSchema.safeParse(makeValidCsf());
    expect(result.success).toBe(true);
  });

  it("rejects invalid name (not npm-style)", () => {
    const result = CanonicalSkillFormatSchema.safeParse(makeValidCsf({ name: "Invalid Name!" }));
    expect(result.success).toBe(false);
  });

  it("rejects non-semver version", () => {
    const result = CanonicalSkillFormatSchema.safeParse(makeValidCsf({ version: "v1" }));
    expect(result.success).toBe(false);
  });

  it("defaults sandboxMode to separate_process", () => {
    const csf = makeValidCsf();
    const result = CanonicalSkillFormatSchema.parse(csf);
    expect(result.manifest.sandboxMode).toBe("separate_process");
  });

  it("rejects invalid verification_status", () => {
    const result = CanonicalSkillFormatSchema.safeParse(
      makeValidCsf({
        provenance: {
          verification_status: "totally-fake",
          contentHash: "abc123def456abc1abc123def456abc1",
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts the 4 valid verification statuses", () => {
    for (const status of ["unverified", "replay_tested", "verified", "marketplace-ready"]) {
      const result = CanonicalSkillFormatSchema.safeParse(
        makeValidCsf({
          provenance: {
            verification_status: status,
            contentHash: "abc123def456abc1abc123def456abc1",
          },
        }),
      );
      expect(result.success, status).toBe(true);
    }
  });

  it("requires compatibility.orqenix as semver range", () => {
    const result = CanonicalSkillFormatSchema.safeParse(
      makeValidCsf({
        manifest: {
          ...makeValidCsf().manifest,
          compatibility: { orqenix: "not-a-version" },
        },
      }),
    );
    expect(result.success).toBe(false);
  });
});
