import { describe, it, expect, vi } from "vitest";
import { DiscoveryStateMachine } from "../src/events.js";
import type { ScopeId } from "@orqenix/mesh-transport-core";

const S = "scp_b3_aa" as ScopeId;

describe("DiscoveryStateMachine", () => {
  it("emits Discovered then transitions through the lifecycle", () => {
    const sm = new DiscoveryStateMachine();
    const seen: string[] = [];
    sm.on((e) => seen.push(e.state));

    sm.discover(S, ["/ip4/127.0.0.1/tcp/1/p2p/x"]);
    sm.transition(S, "Connecting");
    sm.transition(S, "Connected");
    sm.transition(S, "Stale");
    sm.transition(S, "Connected");
    sm.transition(S, "Lost");

    expect(seen).toEqual(["Discovered", "Connecting", "Connected", "Stale", "Connected", "Lost"]);
  });

  it("rejects illegal transitions", () => {
    const sm = new DiscoveryStateMachine();
    sm.discover(S, []);
    expect(() => sm.transition(S, "Connected")).toThrow();
  });

  it("allows re-discovery from Lost", () => {
    const sm = new DiscoveryStateMachine();
    sm.discover(S, []);
    sm.transition(S, "Connecting");
    sm.transition(S, "Lost");
    sm.discover(S, ["/ip4/127.0.0.1/tcp/1/p2p/x"]);
    expect(sm.state(S)).toBe("Discovered");
  });

  it("listener errors do not break emission", () => {
    const sm = new DiscoveryStateMachine();
    const noisy = vi.fn(() => {
      throw new Error("boom");
    });
    const ok = vi.fn();
    sm.on(noisy);
    sm.on(ok);
    sm.discover(S, []);
    expect(noisy).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });

  it("snapshot reflects current entries", () => {
    const sm = new DiscoveryStateMachine();
    sm.discover(S, ["/ip4/127.0.0.1/tcp/1/p2p/x"]);
    const snap = sm.snapshot();
    expect(snap.length).toBe(1);
    expect(snap[0].scopeId).toBe(S);
  });
});
