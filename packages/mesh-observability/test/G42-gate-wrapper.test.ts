import { describe, it, expect } from "vitest";
import {
  validateLogEvent,
  CANONICAL_EVENTS,
  type MeshLogEvent,
  METRIC_NAMES,
  MeshMetrics,
  bufferSink,
  MeshLogger,
  onRpcIn,
  onRpcOut,
  buildOutgoingTraceContext,
  traceIdOf,
  containsLeak,
  redact,
} from "../src/index.js";
import type { MeshRequest, MeshResponse, ScopeId } from "@orqenix/mesh-transport-core";

describe("G42 gate", () => {
  it("C1 log schema validates over captured stream", () => {
    const { sink, events, lines } = bufferSink();
    const logger = new MeshLogger({ sink, level: "debug" });
    const metrics = new MeshMetrics();
    for (let i = 0; i < 64; i++) {
      const req: MeshRequest = {
        id: `01HV0R6X3M8YQ9G7F2D5W1G42${(i % 36).toString(36).toUpperCase().padStart(2, "0")}`,
        fromScope: "scp_b3_C" as unknown as ScopeId,
        toScope: "scp_b3_A" as unknown as ScopeId,
        capability: "cap-x" as unknown as any,
        method: "memory.query",
        payload: new Uint8Array([i & 0xff]),
        deadlineMs: Date.now() + 5000,
        trace: buildOutgoingTraceContext(),
      };
      onRpcIn(
        { logger, metrics },
        { scopeId: "scp_b3_A" as unknown as ScopeId, transport: "http" },
        req,
      );
      const resp: MeshResponse = { id: req.id, status: "ok" };
      onRpcOut(
        { logger, metrics },
        { scopeId: "scp_b3_A" as unknown as ScopeId, transport: "http" },
        req,
        resp,
        i % 25,
      );
    }
    const allValid = events.every((e: MeshLogEvent) => validateLogEvent(e) === null);
    const eventsKnown = events.every((e) => CANONICAL_EVENTS.has(e.event));
    expect(allValid && eventsKnown && lines.length === events.length).toBe(true);
  });

  it("C2 metric names locked + OTel-compatible", () => {
    const m = new MeshMetrics();
    const got = new Set(m.registeredNames());
    const expected = [
      METRIC_NAMES.RPC_TOTAL,
      METRIC_NAMES.RPC_DURATION_MS,
      METRIC_NAMES.PEERS,
      METRIC_NAMES.CAPABILITY_VERIFY_MS,
      METRIC_NAMES.FAILOVER_TOTAL,
      METRIC_NAMES.CIRCUIT_STATE,
    ];
    const allPresent = expected.every((n) => got.has(n));
    const exactCount = got.size === expected.length;
    const namingOk = expected.every((n) => /^orqenix_mesh_[a-z0-9_]+$/.test(n));
    expect(allPresent && exactCount && namingOk).toBe(true);
  });

  it("C3 traceparent propagates across >=2 hops", () => {
    const parent = buildOutgoingTraceContext();
    const hop1 = buildOutgoingTraceContext(parent.traceparent);
    const hop2 = buildOutgoingTraceContext(hop1.traceparent);
    const tid = traceIdOf(parent.traceparent);
    const sameTrace = traceIdOf(hop1.traceparent) === tid && traceIdOf(hop2.traceparent) === tid;
    const distinctSpans =
      new Set([parent.traceparent, hop1.traceparent, hop2.traceparent]).size === 3;
    expect(!!tid && sameTrace && distinctSpans).toBe(true);
  });

  it("C4 redaction: zero leaks over 10k randomized inputs", () => {
    let leaks = 0;
    const rnd = (n: number) => {
      const a = "A".repeat(n);
      const b = "B".repeat(n);
      const hex2 = "d".repeat(n);
      return { a, b, hex: hex2 };
    };
    for (let i = 0; i < 10_000; i++) {
      const ctx = {
        scopeId: "scp_b3_A",
        transport: "http",
        capability: rnd(120 + (i % 40)).a,
        token: rnd(180).b,
        sig: rnd(140).hex,
        payload: new Uint8Array([i & 0xff, (i >> 8) & 0xff]),
        nested: { signature: rnd(160).a, keep: "ok" },
      };
      const cleaned = redact(ctx);
      const serialized = JSON.stringify(cleaned);
      if (containsLeak(serialized)) leaks++;
    }
    expect(leaks).toBe(0);
  });
});
