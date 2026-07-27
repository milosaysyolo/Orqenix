// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi } from "vitest";
import { install, uninstall } from "../src/index.js";

function stubRegistry(overrides: Record<string, any> = {}) {
  return {
    add: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    purge: vi.fn(async () => {}),
    checkConflicts: vi.fn(async () => []),
    get: vi.fn(async (id: string) => ({
      id,
      name: id,
      version: "1.0.0",
      type: "skill",
      state: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    ...overrides,
  };
}

describe("marketplace-client network timeout", () => {
  it("rejects install when checkConflicts times out", async () => {
    const registry = stubRegistry({
      checkConflicts: vi.fn(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("request timed out")), 5),
          ),
      ),
    });

    await expect(
      install("plugin@1.0.0", { registry: registry as any }),
    ).rejects.toThrow(/timed out/);
  });

  it("rejects install when add times out", async () => {
    const registry = stubRegistry({
      add: vi.fn(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("connection timeout")), 5),
          ),
      ),
    });

    await expect(
      install("plugin@1.0.0", { registry: registry as any }),
    ).rejects.toThrow(/timeout/);
  });
});

describe("marketplace-client HTTP 4xx errors", () => {
  it("rejects install on 400 Bad Request from registry", async () => {
    const registry = stubRegistry({
      checkConflicts: vi.fn(async () => {
        throw Object.assign(new Error("Bad Request: invalid ref"), { status: 400 });
      }),
    });

    await expect(
      install("plugin@1.0.0", { registry: registry as any }),
    ).rejects.toThrow(/Bad Request/);
  });

  it("rejects uninstall on 404 Not Found", async () => {
    const registry = stubRegistry({
      get: vi.fn(async () => {
        throw Object.assign(new Error("Not Found: plugin not installed"), { status: 404 });
      }),
    });

    await expect(
      uninstall("missing-plugin@1.0.0", { registry: registry as any }),
    ).rejects.toThrow(/Not Found/);
  });
});

describe("marketplace-client HTTP 5xx errors", () => {
  it("rejects uninstall on 500 Internal Server Error", async () => {
    const registry = stubRegistry({
      remove: vi.fn(async () => {
        throw Object.assign(new Error("Internal Server Error"), { status: 500 });
      }),
    });

    await expect(
      uninstall("plugin@1.0.0", { registry: registry as any }),
    ).rejects.toThrow(/Internal Server Error/);
  });

  it("rejects uninstall purge on 503 Service Unavailable", async () => {
    const registry = stubRegistry({
      purge: vi.fn(async () => {
        throw Object.assign(new Error("Service Unavailable"), { status: 503 });
      }),
    });

    await expect(
      uninstall("plugin@1.0.0", { registry: registry as any, purge: true }),
    ).rejects.toThrow(/Service Unavailable/);
  });
});
