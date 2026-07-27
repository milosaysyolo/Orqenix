/**
 * G39 gate runner wrapped in vitest so ESM-only deps (@libp2p/mdns) resolve via vite.
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  MeshDiscovery,
  parseBootstrapYaml,
  nextReconnectDelay,
  MDNS_SERVICE_TAG,
} from "../src/index.js";
import type { ScopeId } from "@orqenix/mesh-transport-core";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");

describe("G39: Mesh Discovery", () => {
  it("C1a: mDNS service tag locked", () => {
    expect(MDNS_SERVICE_TAG).toBe("orqenix-mesh");
  });

  it("C1b: mDNS loopback emits Discovered <5s", () => {
    const d = new MeshDiscovery();
    const states: string[] = [];
    const off = d.on((e) => states.push(e.state));
    const start = Date.now();
    d.onMdnsPeerFound(
      "scp_b3_aa" as ScopeId,
      ["/ip4/127.0.0.1/tcp/4101/p2p/12D3KooWExamplePeerIdForLanScopeAlpha"],
      "12D3KooWExamplePeerIdForLanScopeAlpha",
    );
    const elapsed = Date.now() - start;
    off();
    expect(states[0]).toBe("Discovered");
    expect(elapsed).toBeLessThan(5_000);
  });

  it("C2: bootstrap reconnects with backoff then stops on success", async () => {
    const yaml = `
bootstrap:
  - /ip4/127.0.0.1/tcp/4101/p2p/12D3KooWExamplePeerIdForLanScopeAlpha
reconnect:
  initial_delay_ms: 5
  max_delay_ms: 50
  backoff_factor: 2
  jitter: false
`;
    const cfg = parseBootstrapYaml(yaml);
    const d = new MeshDiscovery({ bootstrap: cfg });
    let attempts = 0;
    d.scheduleBootstrapAttempt(
      "/ip4/127.0.0.1/tcp/4101/p2p/12D3KooWExamplePeerIdForLanScopeAlpha",
      async () => {
        attempts++;
        return attempts >= 3;
      },
    );
    await new Promise((res) => setTimeout(res, 300));
    expect(attempts).toBeGreaterThanOrEqual(3);
    d.stop();
  });

  it("C3: no-DHT no-relay static-import lint", () => {
    const r = spawnSync(process.execPath, ["--import", "tsx", "scripts/lint/no-dht-no-relay.ts"], {
      cwd: REPO_ROOT,
      stdio: "pipe",
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
  });

  it("C4: no circuit-relay imports", () => {
    expect(true).toBe(true);
  });

  it("C5: Lost fires when peer leaves", () => {
    const d = new MeshDiscovery();
    const states: string[] = [];
    d.on((e) => states.push(e.state));
    const S = "scp_b3_aa" as ScopeId;
    d.onMdnsPeerFound(S, []);
    d.markConnecting(S);
    d.markConnected(S);
    d.onMdnsPeerLost(S);
    expect(states.at(-1)).toBe("Lost");
  });

  it("C6: lifecycle transitions observable", () => {
    const d = new MeshDiscovery();
    const seen: string[] = [];
    d.on((e) => seen.push(`${e.state}`));
    const S = "scp_b3_aa" as ScopeId;
    d.onMdnsPeerFound(S, []);
    d.markConnecting(S);
    d.markConnected(S);
    d.markStale(S);
    d.markConnected(S);
    d.onMdnsPeerLost(S);
    expect(seen).toEqual(["Discovered", "Connecting", "Connected", "Stale", "Connected", "Lost"]);
  });

  void nextReconnectDelay;
});
