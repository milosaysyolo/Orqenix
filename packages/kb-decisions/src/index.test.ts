import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DecisionKB } from "./index.js";

describe("DecisionKB", () => {
  let kb: DecisionKB;
  let dir: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "dkb-"));
    kb = await DecisionKB.open(join(dir, "d.db"));
  });

  afterEach(async () => {
    await kb.close();
  });

  it("appends and retrieves by id", async () => {
    const id = await kb.append({
      type: "DecisionRecord",
      scopeId: "s1",
      title: "Use BSL 1.1",
      body: "License choice for Pro packages",
    });
    const got = await kb.getById(id);
    expect(got).not.toBeNull();
    expect(got!.title).toBe("Use BSL 1.1");
  });

  it("lists by type", async () => {
    await kb.append({ type: "LessonLearned", scopeId: "s1", title: "T1", body: "B1" });
    await kb.append({ type: "DecisionRecord", scopeId: "s1", title: "T2", body: "B2" });
    const lessons = await kb.listByType("LessonLearned", "s1");
    expect(lessons).toHaveLength(1);
    expect(lessons[0]!.title).toBe("T1");
  });

  it("lists by date range", async () => {
    await kb.append({ type: "DecisionRecord", scopeId: "s1", title: "T", body: "B" });
    const list = await kb.listByDate("2020-01-01", "2099-12-31", "s1");
    expect(list.length).toBeGreaterThan(0);
  });

  it("returns null for missing id", async () => {
    const got = await kb.getById("nonexistent");
    expect(got).toBeNull();
  });

  it("enforces unique ids on append", async () => {
    const entry = { type: "DecisionRecord" as const, scopeId: "s1", title: "T", body: "B" };
    await kb.append(entry);
    await kb.append(entry);
    const all = await kb.listByType("DecisionRecord", "s1", 10);
    expect(all.length).toBe(2);
  });
});
