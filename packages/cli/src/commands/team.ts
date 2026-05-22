import { defineCommand } from "citty";
import consola from "consola";
import kleur from "kleur";
import Table from "cli-table3";
import { confirm, input } from "@inquirer/prompts";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import { extract as tarExtract } from "tar";
import isoGit from "isomorphic-git";
import isoGitHttp from "isomorphic-git/http/node";
import { loadConfig } from "@orqenix/core/config";
import { SyncEngine } from "@orqenix/core/sync";

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function projectTeamsDir(root: string): string {
  return join(root, ".orqenix", "teams");
}

function globalTeamsDir(): string {
  const base =
    process.env.ORQENIX_CONFIG_DIR ??
    process.env.XDG_CONFIG_HOME ??
    join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".config");
  return join(base.endsWith("orqenix") ? base : join(base, "orqenix"), "teams");
}

async function listTeamsInDir(dir: string): Promise<Array<{ dir: string; manifest: any }>> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const teams: Array<{ dir: string; manifest: any }> = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const manifestPath = join(dir, e.name, "team.json");
    if (!existsSync(manifestPath)) continue;
    try {
      const m = parseJsonc(await readFile(manifestPath, "utf-8"));
      teams.push({ dir: join(dir, e.name), manifest: m });
    } catch {
      /* skip invalid */
    }
  }
  return teams;
}

export const teamCmd = defineCommand({
  meta: { name: "team", description: "Manage Orqenix teams" },
  subCommands: {
    list: defineCommand({
      meta: { name: "list", description: "List installed teams (project + global)" },
      args: { cwd: { type: "string", default: process.cwd() } },
      async run({ args }) {
        const cwd = args.cwd as string;
        const project = await listTeamsInDir(projectTeamsDir(cwd));
        const global = await listTeamsInDir(globalTeamsDir());

        if (project.length === 0 && global.length === 0) {
          consola.warn("No teams installed yet. Try: orqenix team install <source>");
          return;
        }

        const table = new Table({
          head: [
            kleur.bold("Scope"),
            kleur.bold("Name"),
            kleur.bold("Version"),
            kleur.bold("Lead"),
            kleur.bold("Agents"),
            kleur.bold("Target"),
          ],
          style: { head: [], border: ["gray"] },
        });

        for (const t of project) {
          table.push([
            kleur.green("project"),
            t.manifest.name,
            t.manifest.version,
            `${t.manifest.namingPrefix}-${t.manifest.teamLead.role}`,
            String(
              1 +
                (t.manifest.agents?.core?.length ?? 0) +
                (t.manifest.agents?.optional?.length ?? 0),
            ),
            t.manifest.syncTargets?.opencode?.enabled ? "opencode" : "-",
          ]);
        }
        for (const t of global) {
          table.push([
            kleur.cyan("global"),
            t.manifest.name,
            t.manifest.version,
            `${t.manifest.namingPrefix}-${t.manifest.teamLead.role}`,
            String(
              1 +
                (t.manifest.agents?.core?.length ?? 0) +
                (t.manifest.agents?.optional?.length ?? 0),
            ),
            t.manifest.syncTargets?.opencode?.enabled ? "opencode" : "-",
          ]);
        }
        consola.log(table.toString());
      },
    }),

    show: defineCommand({
      meta: { name: "show", description: "Show a team's manifest and sync state" },
      args: {
        name: { type: "positional", required: true },
        cwd: { type: "string", default: process.cwd() },
      },
      async run({ args }) {
        const cwd = args.cwd as string;
        const teamName = args.name as string;
        const project = await listTeamsInDir(projectTeamsDir(cwd));
        const global = await listTeamsInDir(globalTeamsDir());
        const match = [...project, ...global].find((t) => t.manifest.name === teamName);
        if (!match) {
          consola.error(`Team not found: ${teamName}`);
          return;
        }
        consola.log(kleur.bold("Manifest:"));
        consola.log(JSON.stringify(match.manifest, null, 2));

        const statePath = join(cwd, ".orqenix", "sync", "agents.json");
        if (existsSync(statePath)) {
          const state = JSON.parse(await readFile(statePath, "utf-8"));
          const agents = Object.entries(state.agents ?? {}).filter(
            ([, r]: any) => r.team === teamName,
          );
          consola.log(kleur.bold(`\nSync state: ${agents.length} agent(s) tracked`));
          for (const [name, rec] of agents as any) {
            consola.log(
              `  ${kleur.green("✓")} ${name}  ${kleur.gray("(" + rec.outputHash.slice(7, 15) + "...)")}`,
            );
          }
        } else {
          consola.log(kleur.yellow("\nNo sync state yet. Run: orqenix sync"));
        }
      },
    }),

    create: defineCommand({
      meta: { name: "create", description: "Scaffold a new team" },
      args: {
        name: { type: "positional", required: true },
        cwd: { type: "string", default: process.cwd() },
        description: { type: "string", default: "" },
        leadRole: { type: "string", default: "lead", alias: "lead-role" },
        core: { type: "string", default: "" },
        optional: { type: "string", default: "" },
        skills: { type: "string", default: "" },
        mcp: { type: "string", default: "" },
        yes: { type: "boolean", default: false, alias: "y" },
      },
      async run({ args }) {
        const name = args.name as string;
        const cwd = args.cwd as string;
        const descriptionRaw = args.description as string;
        const yes = args.yes as boolean;
        const coreRaw = args.core as string;
        const optionalRaw = args.optional as string;
        const skillsRaw = args.skills as string;
        const mcpRaw = args.mcp as string;
        const leadRole = args.leadRole as string;

        if (!NAME_RE.test(name)) {
          consola.error(`Invalid team name: ${name}. Must match ${NAME_RE}`);
          process.exit(1);
        }

        const teamDir = join(projectTeamsDir(cwd), name);
        if (existsSync(teamDir)) {
          consola.error(`Team already exists: ${teamDir}`);
          process.exit(1);
        }

        const description =
          descriptionRaw ||
          (yes ? `${name} agent bundle` : await input({ message: "Description:" }));

        const core = (coreRaw ? coreRaw.split(",") : []).map((s) => s.trim()).filter(Boolean);
        const opt = (optionalRaw ? optionalRaw.split(",") : [])
          .map((s) => s.trim())
          .filter(Boolean);
        const skills = (skillsRaw ? skillsRaw.split(",") : []).map((s) => s.trim()).filter(Boolean);
        const mcp = (mcpRaw ? mcpRaw.split(",") : []).map((s) => s.trim()).filter(Boolean);
        if (!NAME_RE.test(leadRole)) {
          consola.error(`Invalid lead role: ${leadRole}`);
          process.exit(1);
        }
        for (const r of [...core, ...opt]) {
          if (!NAME_RE.test(r)) {
            consola.error(`Invalid agent role: ${r}`);
            process.exit(1);
          }
        }

        await mkdir(join(teamDir, "agents"), { recursive: true });

        const manifest = {
          $schema: "https://orqenix.dev/schema/team.json",
          name,
          version: "0.1.0",
          description,
          author: "user",
          license: "Apache-2.0",
          namingPrefix: name,
          teamLead: {
            role: leadRole,
            file: `agents/${leadRole}.md`,
            mode: "primary",
            isTeamLead: true,
          },
          agents: {
            core: core.map((r) => ({ role: r, file: `agents/${r}.md`, mode: "subagent" })),
            optional: opt.map((r) => ({ role: r, file: `agents/${r}.md`, mode: "subagent" })),
          },
          defaultSkills: skills,
          defaultMCP: mcp,
          syncTargets: {
            opencode: {
              enabled: true,
              outputDir: ".opencode/agents",
              filenamePattern: "{prefix}-{role}.md",
            },
          },
        };
        await writeFile(
          join(teamDir, "team.json"),
          JSON.stringify(manifest, null, 2) + "\n",
          "utf-8",
        );

        const writeAgent = async (role: string, isLead: boolean) => {
          const fm = [
            "---",
            `description: ${isLead ? "Lead" : "Subagent"} for ${name}`,
            `mode: ${isLead ? "primary" : "subagent"}`,
            "tools:",
            "  read: true",
            isLead ? "  task: true" : "  write: true",
            "permission:",
            "  edit: ask",
            "orqenix:",
            `  team: ${name}`,
            `  role: ${role}`,
            ...(isLead ? ["  isTeamLead: true"] : []),
            "  knowledge_briefing: true",
            "  capture_decisions: true",
            `  reindex_after: ${isLead ? "none" : "auto"}`,
            isLead ? "  writes: []" : `  writes: ["code", "docs"]`,
            "---",
            "",
            `# ${role}`,
            "",
            `<!-- stub: describe ${role}'s responsibilities and decision matrix (Phase 2) -->`,
            "",
          ].join("\n");
          await writeFile(join(teamDir, "agents", `${role}.md`), fm, "utf-8");
        };

        await writeAgent(leadRole, true);
        for (const r of core) await writeAgent(r, false);
        for (const r of opt) await writeAgent(r, false);

        await writeFile(
          join(teamDir, "README.md"),
          `# ${name}\n\n${description}\n\nLead: ${leadRole}\nCore: ${core.join(", ") || "(none)"}\nOptional: ${opt.join(", ") || "(none)"}\n`,
          "utf-8",
        );

        consola.success(`Created team ${kleur.bold(name)} at ${teamDir}`);

        consola.start("Running sync...");
        const cfg = await loadConfig(cwd);
        const engine = new SyncEngine(cwd, cfg);
        const results = await engine.syncAll();
        for (const r of results) {
          if (r.team === name) {
            consola.success(`Synced ${r.written.length} file(s) for ${name}`);
          }
        }
        consola.info(`Next: orqenix team edit ${name} ${leadRole}`);
      },
    }),

    edit: defineCommand({
      meta: { name: "edit", description: "Open an agent source file in $EDITOR" },
      args: {
        name: { type: "positional", required: true },
        role: { type: "positional", required: true },
        cwd: { type: "string", default: process.cwd() },
      },
      async run({ args }) {
        const cwd = args.cwd as string;
        const teamName = args.name as string;
        const role = args.role as string;
        const path = join(projectTeamsDir(cwd), teamName, "agents", `${role}.md`);
        if (!existsSync(path)) {
          consola.error(`Agent file not found: ${path}`);
          process.exit(1);
        }
        const editor = process.env.EDITOR ?? process.env.VISUAL ?? "vi";
        const { spawn } = await import("node:child_process");
        consola.info(`Opening ${path} in ${editor}`);
        const child = spawn(editor, [path], { stdio: "inherit" });
        child.on("exit", async (code) => {
          if (code !== 0) {
            consola.warn(`Editor exited with code ${code}`);
            return;
          }
          consola.start("Re-syncing...");
          const cfg = await loadConfig(cwd);
          const engine = new SyncEngine(cwd, cfg);
          await engine.syncAll();
          consola.success("Synced");
        });
      },
    }),

    install: defineCommand({
      meta: { name: "install", description: "Install a team from a source" },
      args: {
        source: { type: "positional", required: true },
        cwd: { type: "string", default: process.cwd() },
        name: { type: "string", default: "" },
        force: { type: "boolean", default: false },
      },
      async run({ args }) {
        const src = args.source as string;
        const cwd = args.cwd as string;
        const renameTo = args.name as string;
        const force = args.force as boolean;
        const installFrom = await resolveTeamSource(src);
        try {
          await installTeamFromDir(installFrom.path, cwd, {
            renameTo: renameTo || undefined,
            force,
          });
          consola.success(`Installed team from ${src}`);
          const cfg = await loadConfig(cwd);
          const engine = new SyncEngine(cwd, cfg);
          const results = await engine.syncAll();
          const r = results.find((x) => x.written.length > 0);
          if (r) consola.success(`Synced ${r.written.length} file(s) for ${r.team}`);
        } finally {
          await installFrom.cleanup?.();
        }
      },
    }),

    uninstall: defineCommand({
      meta: { name: "uninstall", description: "Remove an installed team" },
      args: {
        name: { type: "positional", required: true },
        cwd: { type: "string", default: process.cwd() },
        yes: { type: "boolean", default: false, alias: "y" },
      },
      async run({ args }) {
        const cwd = args.cwd as string;
        const teamName = args.name as string;
        const yes = args.yes as boolean;
        const teamDir = join(projectTeamsDir(cwd), teamName);
        if (!existsSync(teamDir)) {
          consola.error(`Team not found: ${teamDir}`);
          process.exit(1);
        }
        if (!yes) {
          const ok = await confirm({
            message: `Remove team ${teamName} and its sources? Output files in .opencode/agents will remain until next sync.`,
            default: false,
          });
          if (!ok) return;
        }
        const { rm } = await import("node:fs/promises");
        await rm(teamDir, { recursive: true, force: true });
        consola.success(`Removed ${teamDir}`);
      },
    }),

    validate: defineCommand({
      meta: { name: "validate", description: "Validate a team manifest and source files" },
      args: {
        name: { type: "positional", required: true },
        cwd: { type: "string", default: process.cwd() },
      },
      async run({ args }) {
        const cwd = args.cwd as string;
        const teamName = args.name as string;
        const teamDir = join(projectTeamsDir(cwd), teamName);
        const manifestPath = join(teamDir, "team.json");
        if (!existsSync(manifestPath)) {
          consola.error(`No manifest: ${manifestPath}`);
          process.exit(1);
        }
        const m = parseJsonc(await readFile(manifestPath, "utf-8"));
        const errors: string[] = [];
        if (!NAME_RE.test(m?.name ?? "")) errors.push(`Invalid name: ${m?.name}`);
        if (!m?.namingPrefix) errors.push("Missing namingPrefix");
        if (!m?.teamLead?.role || !m?.teamLead?.file) errors.push("Missing teamLead");
        const all = [m?.teamLead, ...(m?.agents?.core ?? []), ...(m?.agents?.optional ?? [])];
        for (const a of all) {
          if (!a) continue;
          const p = join(teamDir, a.file);
          if (!existsSync(p)) errors.push(`Source missing: ${a.file}`);
        }
        if (errors.length === 0) {
          consola.success(`Team ${teamName} is valid`);
        } else {
          for (const e of errors) consola.error(e);
          process.exit(1);
        }
      },
    }),
  },
});

// ─────────── Helpers ────────────────────────────────────────────────────

interface ResolvedSource {
  path: string;
  cleanup?: () => Promise<void>;
}

async function resolveTeamSource(src: string): Promise<ResolvedSource> {
  // GitHub shorthand: github:user/repo[#ref][/sub/path]
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
      throw new Error(`Bad GitHub source: ${src}`);
    }
    const sub = subParts.length ? subParts.join("/") : "";
    const tmp = await mkdtemp(join(tmpdir(), "orqenix-team-"));
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
      path: sub ? join(tmp, sub) : tmp,
      cleanup: async () => {
        const { rm } = await import("node:fs/promises");
        await rm(tmp, { recursive: true, force: true });
      },
    };
  }

  // Tarball: .tgz or .tar.gz file
  if (src.endsWith(".tgz") || src.endsWith(".tar.gz")) {
    const abs = isAbsolute(src) ? src : resolve(process.cwd(), src);
    if (!existsSync(abs)) throw new Error(`Tarball not found: ${abs}`);
    const tmp = await mkdtemp(join(tmpdir(), "orqenix-team-"));
    await tarExtract({ file: abs, cwd: tmp });
    return {
      path: tmp,
      cleanup: async () => {
        const { rm } = await import("node:fs/promises");
        await rm(tmp, { recursive: true, force: true });
      },
    };
  }

  // Local directory
  const abs = isAbsolute(src) ? src : resolve(process.cwd(), src);
  if (!existsSync(abs)) throw new Error(`Source not found: ${abs}`);
  return { path: abs };
}

async function installTeamFromDir(
  src: string,
  projectRoot: string,
  opts: { renameTo?: string; force?: boolean },
): Promise<void> {
  // Find team.json (allow nested by one level)
  let teamRoot = src;
  if (!existsSync(join(teamRoot, "team.json"))) {
    const children = await readdir(src, { withFileTypes: true });
    const nested = children.find(
      (e) => e.isDirectory() && existsSync(join(src, e.name, "team.json")),
    );
    if (nested) teamRoot = join(src, nested.name);
    else throw new Error(`No team.json found in ${src}`);
  }

  const manifest = parseJsonc(await readFile(join(teamRoot, "team.json"), "utf-8"));
  const targetName = opts.renameTo ?? manifest.name;
  if (!NAME_RE.test(targetName)) throw new Error(`Invalid team name: ${targetName}`);

  const targetDir = join(projectTeamsDir(projectRoot), targetName);
  if (existsSync(targetDir) && !opts.force) {
    throw new Error(`Team already installed: ${targetName}. Use --force to overwrite.`);
  }

  await mkdir(dirname(targetDir), { recursive: true });
  if (existsSync(targetDir)) {
    const { rm } = await import("node:fs/promises");
    await rm(targetDir, { recursive: true, force: true });
  }
  await cp(teamRoot, targetDir, { recursive: true });

  if (opts.renameTo && opts.renameTo !== manifest.name) {
    const newManifestPath = join(targetDir, "team.json");
    manifest.name = opts.renameTo;
    manifest.namingPrefix = opts.renameTo;
    await writeFile(newManifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  }
}
