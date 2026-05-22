import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverSkills } from "../src/discovery.js";
import { rankSkills } from "../src/ranking.js";

describe("skill discovery + ranking", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "orq-skills-"));
    mkdirSync(join(projectRoot, ".opencode", "skills", "web-search"), { recursive: true });
    mkdirSync(join(projectRoot, ".opencode", "skills", "code-format"), { recursive: true });
    writeFileSync(
      join(projectRoot, ".opencode", "skills", "web-search", "SKILL.md"),
      `---\nname: web-search\ndescription: Searches the web via Brave\n---\nBody`,
    );
    writeFileSync(
      join(projectRoot, ".opencode", "skills", "code-format", "SKILL.md"),
      `---\nname: code-format\ndescription: Formats code with prettier\n---\nBody`,
    );
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("discovers project-local skills", async () => {
    const skills = await discoverSkills(projectRoot);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(["code-format", "web-search"]);
  });

  it("ranks by relevance to query", async () => {
    const skills = await discoverSkills(projectRoot);
    const ranked = rankSkills({ query: "search the internet", skills, topN: 5 });
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]?.skill.name).toBe("web-search");
  });
});
