import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createLedger,
  recordTouch,
  loadLedger,
  saveLedger,
  filterCreated,
  filterModified,
} from "../src/index.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ledger-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("ledger", () => {
  it("creates empty ledger", () => {
    expect(createLedger().entries).toHaveLength(0);
  });

  it("recordTouch appends entry", () => {
    const l = createLedger();
    recordTouch(l, "a.txt", "created", "sha1");
    expect(l.entries).toHaveLength(1);
    expect(l.entries[0]?.action).toBe("created");
  });

  it("recordTouch replaces existing path", () => {
    const l = createLedger();
    recordTouch(l, "a.txt", "created", "sha1");
    recordTouch(l, "a.txt", "modified", "sha2");
    expect(l.entries).toHaveLength(1);
    expect(l.entries[0]?.action).toBe("modified");
  });

  it("save and load roundtrip", async () => {
    const l = createLedger();
    recordTouch(l, "a.txt", "created", "sha1");
    const path = join(dir, "led.json");
    await saveLedger(path, l);
    const loaded = await loadLedger(path);
    expect(loaded.entries).toHaveLength(1);
  });

  it("filterCreated and filterModified", () => {
    const l = createLedger();
    recordTouch(l, "a", "created", "s1");
    recordTouch(l, "b", "modified", "s2");
    expect(filterCreated(l).map((e) => e.path)).toEqual(["a"]);
    expect(filterModified(l).map((e) => e.path)).toEqual(["b"]);
  });
});
