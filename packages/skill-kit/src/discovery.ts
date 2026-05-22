import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import {
  opencodeGlobalConfigDir,
  orqenixGlobalConfigDir,
  projectOpencodeDir,
  projectOrqenixDir,
} from "@orqenix/core";
import type { SkillFile, SkillFrontmatter } from "@orqenix/core";

export interface SkillSource {
  type: "project-opencode" | "project-orqenix" | "global-opencode" | "global-orqenix" | "builtin";
  path: string;
}

export interface DiscoveredSkill {
  name: string;
  source: SkillSource;
  skill: SkillFile;
}

export async function discoverSkills(projectRoot?: string): Promise<DiscoveredSkill[]> {
  const results: DiscoveredSkill[] = [];
  const searchDirs: Array<{ dir: string; type: SkillSource["type"] }> = [];

  if (projectRoot) {
    searchDirs.push(
      { dir: join(projectOpencodeDir(projectRoot), "skills"), type: "project-opencode" },
      { dir: join(projectOrqenixDir(projectRoot), "skills"), type: "project-orqenix" },
    );
  }
  searchDirs.push(
    { dir: join(opencodeGlobalConfigDir(), "skills"), type: "global-opencode" },
    { dir: join(orqenixGlobalConfigDir(), "skills"), type: "global-orqenix" },
  );

  for (const { dir, type } of searchDirs) {
    if (!existsSync(dir)) continue;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const skillMd = join(dir, e.name, "SKILL.md");
      if (!existsSync(skillMd)) continue;
      try {
        const raw = await readFile(skillMd, "utf-8");
        const parsed = matter(raw);
        const fm = parsed.data as SkillFrontmatter;
        results.push({
          name: e.name,
          source: { type, path: skillMd },
          skill: {
            name: fm.name ?? e.name,
            sourcePath: skillMd,
            frontmatter: fm,
            body: parsed.content,
            contentHash: `blake3:pending`,
          },
        });
      } catch {
        /* skip invalid SKILL.md */
      }
    }
  }

  const byName = new Map<string, DiscoveredSkill>();
  for (const s of results) {
    if (!byName.has(s.name)) byName.set(s.name, s);
  }
  return Array.from(byName.values());
}
