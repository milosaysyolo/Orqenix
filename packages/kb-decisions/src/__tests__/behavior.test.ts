import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DecisionKB } from "../index.js";

describe("kb-decisions behavior tests", () => {
  let dbPath: string;
  let kb: DecisionKB;

  beforeEach(async () => {
    dbPath = mkdtempSync(join(tmpdir(), "kb-decisions-test-"));
    kb = await DecisionKB.open(join(dbPath, "decisions.db"));
  });

  afterEach(async () => {
    await kb.close();
    rmSync(dbPath, { recursive: true, force: true });
  });

  it("append returns id and is retrievable by id", async () => {
    const id = await kb.append({
      type: "DecisionRecord",
      scopeId: "test",
      title: "Use Rust",
      body: "Decided to use Rust for performance",
      enforcement: "must",
    });
    expect(typeof id).toBe("string");
    const got = await kb.getById(id);
    expect(got?.title).toBe("Use Rust");
    expect(got?.enforcement).toBe("must");
  });

  it("append with LessonLearned type", async () => {
    const id = await kb.append({
      type: "LessonLearned",
      scopeId: "test",
      title: "Avoid premature optimization",
      body: "Learned that premature optimization is the root of all evil",
      confidence: 0.95,
    });
    expect(typeof id).toBe("string");
    const got = await kb.getById(id);
    expect(got?.type).toBe("LessonLearned");
    expect(got?.confidence).toBe(0.95);
  });

  it("listByType returns entries of specific type", async () => {
    await kb.append({
      type: "DecisionRecord",
      scopeId: "test",
      title: "Decision 1",
      body: "First decision",
      enforcement: "must",
    });
    await kb.append({
      type: "LessonLearned",
      scopeId: "test",
      title: "Lesson 1",
      body: "First lesson",
      confidence: 0.9,
    });
    await kb.append({
      type: "DecisionRecord",
      scopeId: "test",
      title: "Decision 2",
      body: "Second decision",
      enforcement: "should",
    });

    const decisions = await kb.listByType("DecisionRecord", "test");
    expect(decisions.length).toBe(2);
    expect(decisions.every(d => d.type === "DecisionRecord")).toBe(true);
  });

  it("listByDate returns entries in date order", async () => {
    const now = new Date();
    const from = new Date(now.getTime() - 60000).toISOString();
    const to = new Date(now.getTime() + 60000).toISOString();

    const id1 = await kb.append({
      type: "DecisionRecord",
      scopeId: "test",
      title: "First",
      body: "First entry",
      enforcement: "must",
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    const id2 = await kb.append({
      type: "DecisionRecord",
      scopeId: "test",
      title: "Second",
      body: "Second entry",
      enforcement: "must",
    });

    const entries = await kb.listByDate(from, to, "test");
    expect(entries.length).toBeGreaterThanOrEqual(2);
    const ids = entries.map(e => e.id);
    expect(ids.indexOf(id2)).toBeLessThan(ids.indexOf(id1));
  });

  it("semanticSearch returns entries", async () => {
    await kb.append({
      type: "DecisionRecord",
      scopeId: "test",
      title: "Use TypeScript",
      body: "Decided to use TypeScript for type safety",
      enforcement: "must",
    });
    await kb.append({
      type: "DecisionRecord",
      scopeId: "test",
      title: "Use Python",
      body: "Decided to use Python for data science",
      enforcement: "should",
    });

    const results = await kb.semanticSearch(5);
    expect(results.length).toBeGreaterThan(0);
  });

  it("append with ConversationCheckpoint type", async () => {
    const id = await kb.append({
      type: "ConversationCheckpoint",
      scopeId: "test",
      title: "Checkpoint 1",
      body: "Conversation state at checkpoint",
    });
    expect(typeof id).toBe("string");
    const got = await kb.getById(id);
    expect(got?.type).toBe("ConversationCheckpoint");
  });

  it("append with Action type", async () => {
    const id = await kb.append({
      type: "Action",
      scopeId: "test",
      title: "Implement feature X",
      body: "Action to implement feature X",
    });
    expect(typeof id).toBe("string");
    const got = await kb.getById(id);
    expect(got?.type).toBe("Action");
  });

  it("append with RequirementChange type", async () => {
    const id = await kb.append({
      type: "RequirementChange",
      scopeId: "test",
      title: "Add authentication",
      body: "New requirement to add authentication",
    });
    expect(typeof id).toBe("string");
    const got = await kb.getById(id);
    expect(got?.type).toBe("RequirementChange");
  });

  it("append with TradeoffMade type", async () => {
    const id = await kb.append({
      type: "TradeoffMade",
      scopeId: "test",
      title: "Speed vs Memory",
      body: "Chose speed over memory efficiency",
    });
    expect(typeof id).toBe("string");
    const got = await kb.getById(id);
    expect(got?.type).toBe("TradeoffMade");
  });
});
