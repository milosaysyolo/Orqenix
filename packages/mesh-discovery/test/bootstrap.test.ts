import { describe, it, expect } from "vitest";
import {
  parseBootstrapYaml,
  nextReconnectDelay,
  DEFAULT_RECONNECT,
  type ReconnectPolicy,
} from "../src/bootstrap.js";

const GOOD = `
bootstrap:
  - /ip4/192.168.1.50/tcp/4101/p2p/12D3KooWExamplePeerIdForLanScopeAlpha
  - /ip4/192.168.1.51/tcp/4101/p2p/12D3KooWExamplePeerIdForLanScopeBravo

reconnect:
  initial_delay_ms: 500
  max_delay_ms: 10000
  backoff_factor: 2
  jitter: false
`;

describe("bootstrap.yaml parser", () => {
  it("parses a valid file", () => {
    const cfg = parseBootstrapYaml(GOOD);
    expect(cfg.bootstrap.length).toBe(2);
    expect(cfg.reconnect.initialDelayMs).toBe(500);
    expect(cfg.reconnect.maxDelayMs).toBe(10_000);
    expect(cfg.reconnect.jitter).toBe(false);
  });

  it("rejects non-multiaddr entries", () => {
    const bad = `
bootstrap:
  - "not-a-multiaddr"
`;
    expect(() => parseBootstrapYaml(bad)).toThrow();
  });

  it("rejects missing bootstrap list", () => {
    expect(() => parseBootstrapYaml("reconnect: {}")).toThrow();
  });

  it("rejects max_delay_ms < initial_delay_ms", () => {
    const bad = `
bootstrap: ["/ip4/127.0.0.1/tcp/1/p2p/12D3KooWExamplePeerIdForLanScopeAlpha"]
reconnect:
  initial_delay_ms: 5000
  max_delay_ms: 1000
`;
    expect(() => parseBootstrapYaml(bad)).toThrow();
  });

  it("falls back to defaults when reconnect block is absent", () => {
    const minimal = `bootstrap: ["/ip4/127.0.0.1/tcp/1/p2p/12D3KooWExamplePeerIdForLanScopeAlpha"]`;
    const cfg = parseBootstrapYaml(minimal);
    expect(cfg.reconnect).toEqual(DEFAULT_RECONNECT);
  });
});

describe("nextReconnectDelay", () => {
  const policy: ReconnectPolicy = {
    initialDelayMs: 100,
    maxDelayMs: 5_000,
    backoffFactor: 2,
    jitter: false,
  };

  it("grows exponentially up to the cap", () => {
    expect(nextReconnectDelay(policy, 0)).toBe(100);
    expect(nextReconnectDelay(policy, 1)).toBe(200);
    expect(nextReconnectDelay(policy, 2)).toBe(400);
    expect(nextReconnectDelay(policy, 10)).toBe(5_000);
  });

  it("applies jitter when enabled", () => {
    const p = { ...policy, jitter: true };
    const a = nextReconnectDelay(p, 3, () => 0.0);
    const b = nextReconnectDelay(p, 3, () => 0.999);
    expect(a).toBeLessThan(b);
  });
});
