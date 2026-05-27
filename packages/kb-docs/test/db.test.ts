import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openKbDocs, type KbDocsHandle } from "../src/index.js";

let handle: KbDocsHandle;
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kbdocs-"));
  handle = openKbDocs(join(dir, "kb.sqlite"), 4);
});

afterEach(async () => {
  handle.close();
  await rm(dir, { recursive: true, force: true });
});

function makeDoc(id: string, title: string, content: string): import("../src/types.js").DocRecord {
  return { id, path: `docs/${id}.md`, title, content, updatedAt: Date.now() };
}

describe("kb-docs FTS5", () => {
  it("inserts and retrieves doc by text MATCH", () => {
    handle.insertDoc(makeDoc("1", "Intro", "hello world quantum"));
    const hits = handle.searchText("quantum");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.id).toBe("1");
  });

  it("FTS5 tokenizer handles case and stems", () => {
    handle.insertDoc(makeDoc("1", "Running", "running runs runner"));
    const hits = handle.searchText("RUN");
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it("returns snippet with markup", () => {
    handle.insertDoc(makeDoc("1", "Doc", "the quick brown fox jumps"));
    const hits = handle.searchText("brown");
    expect(hits[0]?.snippet).toContain("<b>brown</b>");
  });

  it("deleteDoc removes from FTS and main table", () => {
    handle.insertDoc(makeDoc("1", "X", "alpha beta gamma"));
    expect(handle.count()).toBe(1);
    handle.deleteDoc("1");
    expect(handle.count()).toBe(0);
    expect(handle.searchText("alpha")).toHaveLength(0);
  });

  it("MATCH supports phrase queries", () => {
    handle.insertDoc(makeDoc("1", "X", "the quick brown fox"));
    handle.insertDoc(makeDoc("2", "Y", "quick brown is the name"));
    const hits = handle.searchText('"quick brown"');
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it("rank ordering puts more relevant first", () => {
    handle.insertDoc(makeDoc("1", "X", "alpha"));
    handle.insertDoc(makeDoc("2", "Y", "alpha alpha alpha"));
    const hits = handle.searchText("alpha");
    expect(hits[0]?.id).toBe("2");
  });
});

describe("kb-docs vec0", () => {
  it("stores embedding and searches by MATCH", () => {
    const e1 = new Float32Array([1, 0, 0, 0]);
    const e2 = new Float32Array([0, 1, 0, 0]);
    handle.insertDoc(makeDoc("1", "A", "first"), e1);
    handle.insertDoc(makeDoc("2", "B", "second"), e2);

    const hits = handle.searchVec(new Float32Array([1, 0, 0, 0]), 2);
    expect(hits[0]?.id).toBe("1");
    expect(hits[0]?.distance).toBeLessThan(hits[1]!.distance);
  });

  it("returns no vec hits if no embedding stored", () => {
    handle.insertDoc(makeDoc("1", "A", "first"));
    const hits = handle.searchVec(new Float32Array([1, 0, 0, 0]));
    expect(hits).toHaveLength(0);
  });

  it("re-insert replaces existing embedding", () => {
    const e1 = new Float32Array([1, 0, 0, 0]);
    const e2 = new Float32Array([0, 0, 0, 1]);
    handle.insertDoc(makeDoc("1", "A", "first"), e1);
    handle.insertDoc(makeDoc("1", "A", "first"), e2);
    const hits = handle.searchVec(new Float32Array([0, 0, 0, 1]), 1);
    expect(hits[0]?.distance).toBeLessThan(0.5);
  });
});
