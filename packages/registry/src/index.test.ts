import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Registry } from "./index.js";

describe("Registry", () => {
  let reg: Registry;
  beforeEach(async () => {
    const dir = mkdtempSync(join(tmpdir(), "reg-"));
    reg = await Registry.open(join(dir, "reg.db"));
  });

  it("adds and retrieves entry", async () => {
    await reg.add({ id: "s1", name: "skill-a", version: "1.0.0", type: "skill", state: "ACTIVE" });
    const e = await reg.get("s1");
    expect(e?.name).toBe("skill-a");
    expect(e?.state).toBe("ACTIVE");
  });

  it("transitions state to TRASH on soft remove", async () => {
    await reg.add({ id: "s1", name: "skill-a", version: "1.0.0", type: "skill", state: "ACTIVE" });
    await reg.remove("s1");
    const e = await reg.get("s1");
    expect(e?.state).toBe("TRASH");
  });

  it("hard remove purges", async () => {
    await reg.add({ id: "s1", name: "skill-a", version: "1.0.0", type: "skill", state: "ACTIVE" });
    await reg.purge("s1");
    const e = await reg.get("s1");
    expect(e).toBeNull();
  });

  it("detects name conflict in ACTIVE state", async () => {
    await reg.add({ id: "s1", name: "skill-a", version: "1.0.0", type: "skill", state: "ACTIVE" });
    const conflicts = await reg.checkConflicts({
      id: "s2", name: "skill-a", version: "2.0.0", type: "skill", state: "ACTIVE",
      createdAt: "", updatedAt: "",
    });
    expect(conflicts.length).toBe(1);
  });

  it("filters list by type", async () => {
    await reg.add({ id: "s1", name: "a", version: "1.0.0", type: "skill", state: "ACTIVE" });
    await reg.add({ id: "a1", name: "b", version: "1.0.0", type: "agent", state: "ACTIVE" });
    const skills = await reg.list("skill");
    expect(skills.length).toBe(1);
    expect(skills[0]!.name).toBe("a");
  });
});
