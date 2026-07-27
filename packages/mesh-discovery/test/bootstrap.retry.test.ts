import { describe, it, expect, vi } from "vitest";
import { MeshDiscovery } from "../src/discovery.js";
import { parseBootstrapYaml } from "../src/bootstrap.js";
import type { ScopeId } from "@orqenix/mesh-transport-core";

describe("MeshDiscovery error path coverage (FK-1.1)", () => {
  it("swallows listener errors and continues notifying other listeners", () => {
    const d = new MeshDiscovery();
    const noisy = vi.fn(() => {
      throw new Error("listener crashed");
    });
    const calm = vi.fn();
    d.on(noisy);
    d.on(calm);
    expect(() => {
      d.onMdnsPeerFound("scp_b3_a" as ScopeId, ["/ip4/127.0.0.1/tcp/1/p2p/x"]);
    }).not.toThrow();
    expect(noisy).toHaveBeenCalled();
    expect(calm).toHaveBeenCalled();
  });

  it("rejects illegal state transition", () => {
    const d = new MeshDiscovery();
    d.onMdnsPeerFound("scp_b3_b" as ScopeId, ["/ip4/127.0.0.1/tcp/2/p2p/y"]);
    d.markConnecting("scp_b3_b" as ScopeId);
    d.markConnected("scp_b3_b" as ScopeId);
    expect(() => {
      (d as unknown as { transition: (s: ScopeId, st: string) => void }).transition(
        "scp_b3_b" as ScopeId,
        "Connecting" as never,
      );
    }).toThrow();
  });

  it("bootstrap parse rejects non-object reconnect", () => {
    expect(() => parseBootstrapYaml('bootstrap: []\nreconnect: "invalid"')).toThrow();
  });

  it("bootstrap parse rejects negative int for initial_delay_ms", () => {
    expect(() => parseBootstrapYaml("bootstrap: []\nreconnect:\n  initial_delay_ms: -1")).toThrow();
  });

  it("bootstrap parse rejects non-finite backoff_factor", () => {
    expect(() =>
      parseBootstrapYaml(
        "bootstrap: []\nreconnect:\n  initial_delay_ms: 100\n  backoff_factor: NaN",
      ),
    ).toThrow();
  });

  it("bootstrap parse accepts valid reconnect config", () => {
    const cfg = parseBootstrapYaml(
      "bootstrap: [/ip4/127.0.0.1/tcp/1/p2p/z]\nreconnect:\n  initial_delay_ms: 200",
    );
    expect(cfg.bootstrap).toHaveLength(1);
    expect(cfg.reconnect.initialDelayMs).toBe(200);
  });
});
