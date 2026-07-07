import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTransportsConfig } from "../src/config.js";

const GOOD = `
transports:
  - kind: libp2p
    enabled: true
    listen:
      - /ip4/0.0.0.0/tcp/4101
      - /ip4/0.0.0.0/tcp/4102/ws
  - kind: http
    enabled: true
    listen:
      - http://0.0.0.0:4180
    dedup_cache:
      max_entries: 10000
priority:
  - libp2p
  - http
circuit_breaker:
  failure_threshold: 3
  cooldown_ms: 30000
deadline_default_ms: 5000
`;

describe("transports.yaml", () => {
  it("parses the canonical example", async () => {
    const dir = await mkdtemp(join(tmpdir(), "orqenix-cfg-"));
    try {
      const p = join(dir, "transports.yaml");
      await writeFile(p, GOOD);
      const cfg = await loadTransportsConfig(p);
      expect(cfg.transports.length).toBe(2);
      expect(cfg.priority).toEqual(["libp2p", "http"]);
      expect(cfg.circuitBreaker.failureThreshold).toBe(3);
      expect(cfg.deadlineDefaultMs).toBe(5000);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects unknown transport kind", async () => {
    const bad = `
transports:
  - kind: unknown
    enabled: true
    listen: ["/ip4/0.0.0.0/tcp/4101"]
`;
    const dir = await mkdtemp(join(tmpdir(), "orqenix-cfg-"));
    try {
      const p = join(dir, "transports.yaml");
      await writeFile(p, bad);
      await expect(loadTransportsConfig(p)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid circuit_breaker values", async () => {
    const bad = `
transports: []
circuit_breaker:
  failure_threshold: -1
`;
    const dir = await mkdtemp(join(tmpdir(), "orqenix-cfg-"));
    try {
      const p = join(dir, "transports.yaml");
      await writeFile(p, bad);
      await expect(loadTransportsConfig(p)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
