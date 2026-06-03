// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import {
  buildChain,
  verifyChain,
  appendTag,
  rootTag,
  computeChainHash,
  ProvenanceChainBrokenError,
  InvalidProvenanceTagError,
  type ProvenanceTag,
} from "../src";

const A = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const B = "scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const C = "scope:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const TOK = "tok:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";

function tag(over: Partial<ProvenanceTag> = {}): Omit<ProvenanceTag, "parentChainHash"> {
  return {
    sourceScopeId: A,
    producedAt: "2026-06-02T00:00:00Z",
    sourceKind: "local",
    ...over,
  } as Omit<ProvenanceTag, "parentChainHash">;
}

describe("provenance chain", () => {
  it("rootTag builds a 1-tag chain", () => {
    const chain = rootTag(tag());
    expect(chain.tags).toHaveLength(1);
    expect(chain.chainHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifyChain passes on legitimate chain", () => {
    const c1 = rootTag(tag({ sourceScopeId: A }));
    const c2 = appendTag(c1, tag({ sourceScopeId: B, sourceKind: "mesh", tokenJti: TOK }));
    const c3 = appendTag(c2, tag({ sourceScopeId: C, sourceKind: "distilled" }));
    expect(() => verifyChain(c3)).not.toThrow();
  });

  it("appendTag sets correct parentChainHash", () => {
    const c1 = rootTag(tag());
    const c2 = appendTag(c1, tag({ sourceScopeId: B, sourceKind: "mesh", tokenJti: TOK }));
    expect(c2.tags[1].parentChainHash).toBe(c1.chainHash);
  });

  it("verifyChain detects tampered chainHash", () => {
    const c = rootTag(tag());
    const tampered = { ...c, chainHash: "f".repeat(64) as any };
    expect(() => verifyChain(tampered)).toThrow(ProvenanceChainBrokenError);
  });

  it("verifyChain detects tampered intermediate tag", () => {
    const c1 = rootTag(tag());
    const c2 = appendTag(c1, tag({ sourceScopeId: B, sourceKind: "mesh", tokenJti: TOK }));
    const tamperedTags = [{ ...c2.tags[0], originPath: "mutated!" }, c2.tags[1]];
    const tampered = { tags: tamperedTags, chainHash: c2.chainHash };
    expect(() => verifyChain(tampered)).toThrow(ProvenanceChainBrokenError);
  });

  it("buildChain rejects root with parentChainHash", () => {
    const bogus: ProvenanceTag = {
      ...tag(),
      parentChainHash: "0".repeat(64),
    };
    expect(() => buildChain([bogus])).toThrow(ProvenanceChainBrokenError);
  });

  it("buildChain rejects broken link mid-chain", () => {
    const c1 = rootTag(tag());
    const fakeTag: ProvenanceTag = {
      ...tag({ sourceScopeId: B, sourceKind: "mesh", tokenJti: TOK }),
      parentChainHash: "f".repeat(64),
    };
    expect(() => buildChain([...c1.tags, fakeTag])).toThrow(ProvenanceChainBrokenError);
  });

  it("mesh source without tokenJti is rejected", () => {
    expect(() => buildChain([tag({ sourceKind: "mesh" }) as ProvenanceTag])).toThrow(
      InvalidProvenanceTagError,
    );
  });

  it("rejects chain longer than 32 tags", () => {
    const tags: ProvenanceTag[] = [{ ...tag() } as ProvenanceTag];
    let chain = buildChain(tags);
    for (let i = 0; i < 31; i++) {
      chain = appendTag(chain, tag({ sourceScopeId: A, sourceKind: "distilled" }));
    }
    expect(() => appendTag(chain, tag({ sourceScopeId: A, sourceKind: "distilled" }))).toThrow(
      InvalidProvenanceTagError,
    );
  });

  it("computeChainHash is deterministic + order-sensitive", () => {
    const t1 = { ...tag({ sourceScopeId: A }) } as ProvenanceTag;
    const t2 = {
      ...tag({ sourceScopeId: B, sourceKind: "mesh", tokenJti: TOK }),
      parentChainHash: computeChainHash([t1]),
    } as ProvenanceTag;
    const a = computeChainHash([t1, t2]);
    const b = computeChainHash([t1, t2]);
    expect(a).toBe(b);
    const swapped = computeChainHash([t2, t1]);
    expect(swapped).not.toBe(a);
  });
});
