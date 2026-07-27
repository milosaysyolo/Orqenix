import { describe, it, expect, vi } from "vitest";
import { MeshDiscovery } from "../src/discovery.js";
import type { ScopeId } from "@orqenix/mesh-transport-core";

const S = "scp_b3_aa" as ScopeId;

describe("MeshDiscovery", () => {
  it("emits Discovered on mDNS peer found", () => {
    const d = new MeshDiscovery();
    const seen: string[] = [];
    d.on((e) => seen.push(e.state));
    d.onMdnsPeerFound(S, ["/ip4/192.168.1.50/tcp/4101/p2p/x"]);
    expect(seen).toEqual(["Discovered"]);
  });

  it("does NOT auto-dial; only emits events", () => {
    const d = new MeshDiscovery();
    expect((d as unknown as { dial?: unknown }).dial).toBeUndefined();
  });

  it("schedules bootstrap reconnect with backoff and stops on success", async () => {
    const d = new MeshDiscovery({
      bootstrap: {
        bootstrap: ["/ip4/127.0.0.1/tcp/1/p2p/x"],
        reconnect: { initialDelayMs: 5, maxDelayMs: 20, backoffFactor: 2, jitter: false },
      },
    });
    let attempts = 0;
    const attemptFn = vi.fn(async () => {
      attempts++;
      return attempts >= 3;
    });
    d.scheduleBootstrapAttempt("/ip4/127.0.0.1/tcp/1/p2p/x", attemptFn, () => 0.5);
    await new Promise((res) => setTimeout(res, 200));
    expect(attemptFn).toHaveBeenCalled();
    expect(attempts).toBeGreaterThanOrEqual(3);
    d.stop();
  });

  it("stop() clears pending bootstrap timers", () => {
    const d = new MeshDiscovery({
      bootstrap: {
        bootstrap: ["/ip4/127.0.0.1/tcp/1/p2p/x"],
        reconnect: { initialDelayMs: 1_000, maxDelayMs: 10_000, backoffFactor: 2, jitter: false },
      },
    });
    d.scheduleBootstrapAttempt("/ip4/127.0.0.1/tcp/1/p2p/x", async () => false);
    expect(d.pendingBootstrap()).toBe(1);
    d.stop();
    expect(d.pendingBootstrap()).toBe(0);
  });

  it("emits Lost on mDNS peer lost from Connected", () => {
    const d = new MeshDiscovery();
    const states: string[] = [];
    d.on((e) => states.push(e.state));
    d.onMdnsPeerFound(S, []);
    d.markConnecting(S);
    d.markConnected(S);
    d.onMdnsPeerLost(S);
    expect(states.at(-1)).toBe("Lost");
  });
});
