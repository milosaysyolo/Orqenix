import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddressBook, loadPeersYaml } from "../src/address-book.js";
import type { ScopeId } from "@orqenix/mesh-transport-core";

describe("AddressBook", () => {
  it("resolves http and libp2p kinds independently", () => {
    const b = new AddressBook();
    b.set("scp_b3_a" as ScopeId, { http: "http://10.0.0.5:4180" });
    expect(b.resolve("http", "scp_b3_a" as ScopeId)).toEqual({
      kind: "http",
      baseUrl: "http://10.0.0.5:4180",
    });
    expect(b.resolve("libp2p", "scp_b3_a" as ScopeId)).toBeUndefined();
  });

  it("loads peers.yaml and validates multiaddrs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "orqenix-peers-"));
    try {
      const p = join(dir, "peers.yaml");
      await writeFile(
        p,
        `
peers:
  - scope: scp_b3_a
    http: http://10.0.0.5:4180
    libp2p: /ip4/10.0.0.5/tcp/4101/p2p/12D3KooWExamplePeerIdForLanScopeAlpha
`,
      );
      const b = await loadPeersYaml(p);
      expect(b.size()).toBe(1);
      expect(b.resolve("libp2p", "scp_b3_a" as ScopeId)?.kind).toBe("libp2p");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects malformed multiaddr in peers.yaml", async () => {
    const dir = await mkdtemp(join(tmpdir(), "orqenix-peers-"));
    try {
      const p = join(dir, "peers.yaml");
      await writeFile(
        p,
        `
peers:
  - scope: scp_b3_a
    libp2p: not-a-multiaddr
`,
      );
      await expect(loadPeersYaml(p)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
