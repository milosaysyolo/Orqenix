// packages/mesh-transport-core/test/errors.test.ts
import { describe, it, expect } from "vitest";
import {
  toMeshResponse,
  TransportError,
  CapabilityError,
  DeadlineExceeded,
  HandlerError,
  IllegalStateError,
  ErrorCode,
} from "../src/errors.js";

const STACK_OR_PATH = /(?:\s*at\s+\S+\s*\()|(?:[\/\\][\w.\/\\-]+\.(?:ts|js|mjs|cjs))/;

describe("toMeshResponse", () => {
  it("maps CapabilityError to denied", () => {
    const r = toMeshResponse("r1", new CapabilityError("missing", ErrorCode.CAP_MISSING));
    expect(r.status).toBe("denied");
    expect(r.error?.code).toBe("E_CAP_MISSING");
  });

  it("maps DeadlineExceeded to timeout", () => {
    const r = toMeshResponse("r2", new DeadlineExceeded());
    expect(r.status).toBe("timeout");
    expect(r.error?.code).toBe("E_TIMEOUT");
  });

  it("maps HandlerError to error", () => {
    const r = toMeshResponse("r3", new HandlerError("boom"));
    expect(r.status).toBe("error");
    expect(r.error?.code).toBe("E_HANDLER");
  });

  it("maps TransportError to error", () => {
    const r = toMeshResponse("r4", new TransportError("socket closed"));
    expect(r.status).toBe("error");
    expect(r.error?.code).toBe("E_TRANSPORT");
  });

  it("maps IllegalStateError to error", () => {
    const r = toMeshResponse("r5", new IllegalStateError("bad state"));
    expect(r.status).toBe("error");
    expect(r.error?.code).toBe("E_ILLEGAL_STATE");
  });

  it("maps unknown to E_UNKNOWN", () => {
    const r = toMeshResponse("r6", new Error("weird"));
    expect(r.status).toBe("error");
    expect(r.error?.code).toBe("E_UNKNOWN");
  });

  it("never includes a stack frame or absolute path in the message", () => {
    const synth = new Error("something failed at Foo (/abs/path/to/file.ts:10:5)");
    synth.stack = "Error: x\n    at Foo (/abs/path/to/file.ts:10:5)";
    const r = toMeshResponse("r7", synth);
    expect(STACK_OR_PATH.test(r.error?.message ?? "")).toBe(false);
  });
});
