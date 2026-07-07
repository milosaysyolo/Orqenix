// packages/mesh-transport-core/test/registry.test.ts
import { describe, it, expect } from "vitest";
import { DefaultTransportRegistry } from "../src/registry.js";
import { LoopbackTransport } from "../src/loopback.js";
import type { ScopeId } from "../src/types.js";

describe("DefaultTransportRegistry", () => {
  it("registers, gets, and unregisters", () => {
    const reg = new DefaultTransportRegistry();
    const t = new LoopbackTransport("scp_b3_a" as ScopeId);
    reg.register(t);
    expect(reg.get("loopback")).toBe(t);
    reg.unregister("loopback");
    expect(reg.get("loopback")).toBeUndefined();
  });

  it("throws on duplicate kind registration", () => {
    const reg = new DefaultTransportRegistry();
    reg.register(new LoopbackTransport("scp_b3_a" as ScopeId));
    expect(() => reg.register(new LoopbackTransport("scp_b3_b" as ScopeId))).toThrow();
  });

  it("all() returns registered transports", () => {
    const reg = new DefaultTransportRegistry();
    const t = new LoopbackTransport("scp_b3_a" as ScopeId);
    reg.register(t);
    expect(reg.all()).toEqual([t]);
  });

  it("reachable returns deterministic order across repeated calls", () => {
    const reg = new DefaultTransportRegistry();
    reg.register(new LoopbackTransport("scp_b3_a" as ScopeId));
    const a = reg.reachable("scp_b3_target" as ScopeId).map((t) => t.kind);
    const b = reg.reachable("scp_b3_target" as ScopeId).map((t) => t.kind);
    expect(a).toEqual(b);
  });

  it("reachable returns empty for unregistered kinds", () => {
    const reg = new DefaultTransportRegistry();
    expect(reg.reachable("scp_b3_target" as ScopeId)).toEqual([]);
  });
});
