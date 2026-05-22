import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { extract as tarExtract } from "tar";
import isoGit from "isomorphic-git";
import isoGitHttp from "isomorphic-git/http/node/index.js";
import { projectOpencodeDir } from "@orqenix/core";

export interface SkillInstallSource {
  raw: string;
}

export interface ResolvedSkillSource {
  rootDir: string;
  cleanup?: () => Promise<void>;
}

export async function resolveSkillSource(src: string): Promise<ResolvedSkillSource> {
  if (src.startsWith("github:")) {
    const spec = src.slice("github:".length);
    const [repoAndRef, ...subParts] = spec.split("/").reduce<string[][]>(
      (acc, part, idx) => {
        if (idx < 2) acc[0]?.push(part);
        else acc[1]?.push(part);
        return acc;
      },
      [[], []],
    );
    const repoSpec = (repoAndRef ?? []).join("/");
    const [repo, ref] = repoSpec.split("#");
    if (!repo || repo.split("/").length !== 2) {
      throw new Error(`Bad GitHub skill source: ${src}`);
    }
    const sub = subParts.length ? subParts.join("/") : "";
    const tmp = await mkdtemp(join(tmpdir(), "orqenix-skill-"));
    await isoGit.clone({
      fs: await import("node:fs"),
      http: isoGitHttp as any,
      dir: tmp,
      url: `https://github.com/${repo}.git`,
      ref: ref ?? undefined,
      singleBranch: true,
      depth: 1,
    });
    return {
      rootDir: sub ? join(tmp, sub) : tmp,
      cleanup: async () => {
        const { rm } = await import("node:fs/promises");
        await rm(tmp, { recursive: true, force: true });
      },
    };
  }

  if (src.endsWith(".tgz") || src.endsWith(".tar.gz")) {
    const abs = isAbsolute(src) ? src : resolve(process.cwd(), src);
    if (!existsSync(abs)) throw new Error(`Tarball not found: ${abs}`);
    const tmp = await mkdtemp(join(tmpdir(), "orqenix-skill-"));
    await tarExtract({ file: abs, cwd: tmp });
    return {
      rootDir: tmp,
      cleanup: async () => {
        const { rm } = await import("node:fs/promises");
        await rm(tmp, { recursive: true, force: true });
      },
    };
  }

  const abs = isAbsolute(src) ? src : resolve(process.cwd(), src);
  if (!existsSync(abs)) throw new Error(`Skill source not found: ${abs}`);
  return { rootDir: abs };
}

export async function installSkillsFromDir(
  resolvedDir: string,
  projectRoot: string,
  opts: { force?: boolean } = {},
): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const skillsDir = join(projectOpencodeDir(projectRoot), "skills");
  await mkdir(skillsDir, { recursive: true });

  const candidates = await readdir(resolvedDir, { withFileTypes: true });
  const installed: string[] = [];

  if (existsSync(join(resolvedDir, "SKILL.md"))) {
    const name = await readSkillName(resolvedDir);
    const dest = join(skillsDir, name);
    if (existsSync(dest) && !opts.force) {
      throw new Error(`Skill already installed: ${name}. Use --force.`);
    }
    if (existsSync(dest)) {
      const { rm } = await import("node:fs/promises");
      await rm(dest, { recursive: true, force: true });
    }
    await cp(resolvedDir, dest, { recursive: true });
    installed.push(name);
    return installed;
  }

  for (const e of candidates) {
    if (!e.isDirectory()) continue;
    const dir = join(resolvedDir, e.name);
    if (!existsSync(join(dir, "SKILL.md"))) continue;
    const name = await readSkillName(dir);
    const dest = join(skillsDir, name);
    if (existsSync(dest) && !opts.force) continue;
    if (existsSync(dest)) {
      const { rm } = await import("node:fs/promises");
      await rm(dest, { recursive: true, force: true });
    }
    await cp(dir, dest, { recursive: true });
    installed.push(name);
  }
  return installed;
}

async function readSkillName(dir: string): Promise<string> {
  const matter = (await import("gray-matter")).default;
  const raw = await readFile(join(dir, "SKILL.md"), "utf-8");
  const parsed = matter(raw);
  const name = (parsed.data as { name?: string }).name;
  if (!name) throw new Error(`SKILL.md missing name field: ${dir}`);
  return name;
}
