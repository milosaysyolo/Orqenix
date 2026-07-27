// SPDX-License-Identifier: Apache-2.0
// Conformance verification: ALL 14 reference plugins must pass the conformance
// suite (G70-03). This is the CI gate that proves the references are valid.

import { describe, it, expect } from "vitest";
import { ConformanceSuite, validateManifest } from "@orqenix/plugin-core";

// Import each reference plugin's package.json
import notionPkg from "../../../plugins/notion-source/package.json";
import bgeEmbedPkg from "../../../plugins/bge-embedding/package.json";
import bgeRerankPkg from "../../../plugins/bge-reranker/package.json";
import compressionPkg from "../../../plugins/semantic-compression/package.json";
import injectionPkg from "../../../plugins/windowed-injection/package.json";
import rewriterPkg from "../../../plugins/qwen-rewriter/package.json";
import vizPkg from "../../../plugins/timeline-viz/package.json";
import analyzerPkg from "../../../plugins/python-analyzer/package.json";
import kbSchemaPkg from "../../../plugins/design-kb/package.json";
import mcpServerPkg from "../../../plugins/example-mcp-server/package.json";
import agentPkg from "../../../plugins/example-agent/package.json";
import subagentPkg from "../../../plugins/test-runner-subagent/package.json";
import skillPkg from "../../../plugins/git-commit-conventional/package.json";
import bindingPkg from "../../../plugins/claude-code-binding-ref/package.json";

const REFERENCE_PLUGINS: Array<{ name: string; pkg: unknown; kind: string }> = [
  { name: "notion-source", pkg: notionPkg, kind: "knowledge-source" },
  { name: "bge-embedding", pkg: bgeEmbedPkg, kind: "embedding-model" },
  { name: "bge-reranker", pkg: bgeRerankPkg, kind: "reranker" },
  { name: "semantic-compression", pkg: compressionPkg, kind: "compression-strategy" },
  { name: "windowed-injection", pkg: injectionPkg, kind: "memory-injection-strategy" },
  { name: "qwen-rewriter", pkg: rewriterPkg, kind: "prompt-rewriter" },
  { name: "timeline-viz", pkg: vizPkg, kind: "visualization" },
  { name: "python-analyzer", pkg: analyzerPkg, kind: "code-analyzer" },
  { name: "design-kb", pkg: kbSchemaPkg, kind: "kb-schema" },
  { name: "example-mcp-server", pkg: mcpServerPkg, kind: "mcp-server" },
  { name: "example-agent", pkg: agentPkg, kind: "agent" },
  { name: "test-runner-subagent", pkg: subagentPkg, kind: "subagent" },
  { name: "git-commit-conventional", pkg: skillPkg, kind: "skill" },
  { name: "claude-code-binding-ref", pkg: bindingPkg, kind: "agent-binding" },
];

describe("Reference plugins conformance (G70-03)", () => {
  it("exactly 14 reference plugins (one per kind)", () => {
    expect(REFERENCE_PLUGINS).toHaveLength(14);
    const kinds = new Set(REFERENCE_PLUGINS.map((p) => p.kind));
    expect(kinds.size).toBe(14); // all 14 kinds covered
  });

  for (const ref of REFERENCE_PLUGINS) {
    describe(ref.name, () => {
      it("has a valid manifest", () => {
        const result = validateManifest(ref.pkg);
        expect(result.valid, result.errors.join("; ")).toBe(true);
      });

      it("declares the expected kind", () => {
        const result = validateManifest(ref.pkg);
        expect(result.csf?.kind).toBe(ref.kind);
      });

      it("passes the conformance suite (no failures)", () => {
        const result = validateManifest(ref.pkg);
        expect(result.csf).toBeDefined();
        const suite = new ConformanceSuite();
        // Conformance needs a computed content hash; loader sets it normally.
        // For manifest-level conformance, set a placeholder valid hash.
        if (result.csf) {
          result.csf.provenance.contentHash = "a".repeat(32);
          const report = suite.run(result.csf);
          expect(
            report.failed,
            JSON.stringify(report.checks.filter((c) => c.status === "fail")),
          ).toBe(0);
        }
      });
    });
  }
});
