import { describe, it, expect } from "vitest";
import {
  buildOutgoingTraceContext,
  deriveChildSpan,
  formatTraceparent,
  newTraceparent,
  parseTraceparent,
  traceIdOf,
  validateTraceparent,
} from "../src/trace.js";

describe("traceparent", () => {
  it("newTraceparent is well-formed and validates", () => {
    const tp = newTraceparent();
    expect(validateTraceparent(tp)).toBe(true);
    const parsed = parseTraceparent(tp)!;
    expect(parsed.version).toBe("00");
    expect(parsed.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(parsed.spanId).toMatch(/^[0-9a-f]{16}$/);
  });

  it("deriveChildSpan keeps trace-id and rolls span-id", () => {
    const parent = newTraceparent();
    const child = deriveChildSpan(parent);
    const p = parseTraceparent(parent)!;
    const c = parseTraceparent(child)!;
    expect(c.traceId).toBe(p.traceId);
    expect(c.spanId).not.toBe(p.spanId);
  });

  it("validateTraceparent rejects malformed inputs", () => {
    expect(validateTraceparent("not-a-traceparent")).toBe(false);
    expect(validateTraceparent("01-abc-def-00")).toBe(false);
    expect(validateTraceparent("00-" + "a".repeat(31) + "-" + "b".repeat(16) + "-01")).toBe(false);
  });

  it("formatTraceparent round-trips through parse", () => {
    const tp = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    const p = parseTraceparent(tp)!;
    expect(formatTraceparent(p)).toBe(tp);
  });

  it("buildOutgoingTraceContext derives child from parent", () => {
    const parent = newTraceparent();
    const ctx = buildOutgoingTraceContext(parent);
    expect(traceIdOf(ctx.traceparent)).toBe(traceIdOf(parent));
  });

  it("buildOutgoingTraceContext starts a fresh root when no parent provided", () => {
    const ctx = buildOutgoingTraceContext();
    expect(validateTraceparent(ctx.traceparent)).toBe(true);
  });
});
