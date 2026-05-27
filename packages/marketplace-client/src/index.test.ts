import { describe, it, expect, beforeEach, vi } from "vitest";
import { install, uninstall } from "./index.js";

const mockRegistry = {
  add: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
  purge: vi.fn(async () => {}),
  checkConflicts: vi.fn(async () => [] as any),
  get: vi.fn(async (id: string) => ({ id, name: id, version: "1.0.0", type: "skill", state: "ACTIVE" })),
};

const opts = { registry: mockRegistry as any, policy: { requireSignature: false } };

describe("marketplace-client", () => {
  beforeEach(() => {
    mockRegistry.add.mockClear();
    mockRegistry.remove.mockClear();
    mockRegistry.purge.mockClear();
    mockRegistry.checkConflicts.mockClear();
  });

  it("install routes to registry add", async () => {
    await install("skill-a@1.0.0", opts);
    expect(mockRegistry.add).toHaveBeenCalledOnce();
  });

  it("install fails on conflict", async () => {
    mockRegistry.checkConflicts.mockResolvedValueOnce([{ id: "s1" }] as any);
    await expect(install("skill-a@1.0.0", opts)).rejects.toThrow(/conflict/i);
  });

  it("uninstall soft routes to TRASH", async () => {
    await uninstall("skill-a", { registry: mockRegistry as any, purge: false });
    expect(mockRegistry.remove).toHaveBeenCalledWith("skill-a");
  });

  it("uninstall purge routes to hard delete", async () => {
    await uninstall("skill-a", { registry: mockRegistry as any, purge: true });
    expect(mockRegistry.purge).toHaveBeenCalledWith("skill-a");
  });
});
