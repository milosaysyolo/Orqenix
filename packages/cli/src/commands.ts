// SPDX-License-Identifier: Apache-2.0
// @bc CS-027 CLI Commands
// @gate G25.1, G25.2, G25.3

import { initScope, loadScope, parseScopeYaml } from "@orqenix/scope-identity";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import { ScopeLinkStore, SCOPE_LINK_MIGRATIONS } from "@orqenix/scope-link";
import { WorkspaceStore, WORKSPACE_MIGRATIONS } from "@orqenix/workspace";
import { AuditLogStore, AUDIT_LOG_MIGRATIONS } from "@orqenix/audit-log";
import type { AuditEventKind } from "@orqenix/audit-log";
import type { LinkStatus } from "@orqenix/scope-link";
import { DetachPlanner, DetachExecutor } from "@orqenix/detach";
import { PhaseFourToFiveMigrator } from "@orqenix/migration";
import * as ed from "@noble/ed25519";
import { stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { type ParsedArgs, flagString, flagBool } from "./parser.js";

export interface CliIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}
export interface CliContext {
  rootDir: string;
  dbPath: string;
  scopeId: string;
  io: CliIO;
}
export interface CliResult {
  exitCode: number;
  output?: string;
}
export type CommandHandler = (ctx: CliContext, args: ParsedArgs) => Promise<CliResult>;

function openConn(ctx: CliContext): SqliteConnection {
  const conn = new SqliteConnection({ path: ctx.dbPath });
  runMigrations(conn, [...SCOPE_LINK_MIGRATIONS, ...WORKSPACE_MIGRATIONS, ...AUDIT_LOG_MIGRATIONS]);
  return conn;
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

const handlers: Record<string, CommandHandler> = {
  version: async (_ctx) => ({
    exitCode: 0,
    output: json({ version: pkg.version, phase: "Phase 5 Memory Foundation Refactor" }),
  }),

  "scope info": async (ctx) => {
    if (!ctx.scopeId)
      return { exitCode: 1, output: "error: no scope ID — run 'orqenix init' first" };
    return {
      exitCode: 0,
      output: json({ scopeId: ctx.scopeId, rootDir: ctx.rootDir, dbPath: ctx.dbPath }),
    };
  },

  init: async (ctx, args) => {
    const name = flagString(args, "name") || ctx.rootDir.split("/").pop() || "project";
    try {
      const result = await initScope({ rootDir: ctx.rootDir, name });
      return {
        exitCode: 0,
        output: json({
          scopeId: result.scopeId,
          scopeYamlPath: result.scopeYamlPath,
          identityKeyPath: result.identityKeyPath,
        }),
      };
    } catch (e) {
      return { exitCode: 1, output: `error: ${(e as Error).message}` };
    }
  },

  doctor: async (ctx) => {
    const results: Array<Record<string, string>> = [];
    const orqDir = join(ctx.rootDir, ".orqenix");
    const scopeYamlPath = join(orqDir, "scope.yaml");
    const identityKeyPath = join(orqDir, "identity.key");

    {
      const ver = process.version;
      const major = parseInt(ver.slice(1).split(".")[0]!, 10);
      const r: Record<string, string> = { check: "node-version", status: "ok" };
      if (major < 20) {
        r.status = "fail";
        r.error = `Node >=20 required, got ${ver}`;
      }
      results.push(r);
    }

    {
      const r: Record<string, string> = { check: "scope-yaml", status: "ok" };
      try {
        const raw = await readFile(scopeYamlPath, "utf-8");
        parseScopeYaml(raw);
      } catch (e) {
        r.status = "fail";
        r.error = (e as Error).message;
      }
      results.push(r);
    }

    {
      const r: Record<string, string> = { check: "identity-key", status: "ok" };
      try {
        const st = await stat(identityKeyPath);
        const mode = st.mode & 0o777;
        if (mode !== 0o600) {
          r.status = "fail";
          r.error = `expected mode 0600, got ${mode.toString(8).padStart(3, "0")}`;
        }
      } catch (e) {
        r.status = "fail";
        r.error = (e as Error).message;
      }
      results.push(r);
    }

    {
      const r: Record<string, string> = { check: "sqlite", status: "ok" };
      try {
        const conn = new SqliteConnection({ path: ":memory:" });
        try {
          runMigrations(conn, [
            ...SCOPE_LINK_MIGRATIONS,
            ...WORKSPACE_MIGRATIONS,
            ...AUDIT_LOG_MIGRATIONS,
          ]);
        } finally {
          conn.close();
        }
      } catch (e) {
        r.status = "fail";
        r.error = (e as Error).message;
      }
      results.push(r);
    }

    {
      const r: Record<string, string> = { check: "keypair", status: "ok" };
      try {
        const { keyPair } = await loadScope(ctx.rootDir);
        const msg = new TextEncoder().encode("orqenix-doctor-verify");
        const sig = await ed.signAsync(msg, keyPair.privateKey);
        const ok = await ed.verifyAsync(sig, msg, keyPair.publicKey);
        if (!ok) {
          r.status = "fail";
          r.error = "signature round-trip failed";
        }
      } catch (e) {
        r.status = "fail";
        r.error = (e as Error).message;
      }
      results.push(r);
    }

    const failed = results.filter((r) => r.status === "fail").length;
    return { exitCode: failed, output: json({ results }) };
  },

  "scope init": async (ctx, args) => {
    if (!ctx.scopeId)
      return { exitCode: 1, output: "error: no scope ID — run 'orqenix init' first" };
    const name = flagString(args, "name");
    if (!name) return { exitCode: 1, output: "error: --name is required" };
    return {
      exitCode: 0,
      output: json({
        status: "scope initialized (stub - see scope-identity.initScope)",
        name,
        scopeId: ctx.scopeId,
      }),
    };
  },

  "link create": async (ctx, args) => {
    if (!ctx.scopeId)
      return { exitCode: 1, output: "error: no scope ID — run 'orqenix init' first" };
    const remote = flagString(args, "remote");
    const direction = flagString(args, "direction", "outbound") as "outbound" | "inbound";
    if (!remote) return { exitCode: 1, output: "error: --remote is required" };
    const conn = openConn(ctx);
    try {
      const store = new ScopeLinkStore({ conn, localScopeId: ctx.scopeId });
      const link = store.create({ remoteScopeId: remote, direction });
      return { exitCode: 0, output: json(link) };
    } finally {
      conn.close();
    }
  },

  "link list": async (ctx, args) => {
    if (!ctx.scopeId)
      return { exitCode: 1, output: "error: no scope ID — run 'orqenix init' first" };
    const status = flagString(args, "status") as LinkStatus | undefined;
    const conn = openConn(ctx);
    try {
      const store = new ScopeLinkStore({ conn, localScopeId: ctx.scopeId });
      const links = store.list({ status });
      return { exitCode: 0, output: json(links) };
    } finally {
      conn.close();
    }
  },

  "link revoke": async (ctx, args) => {
    if (!ctx.scopeId)
      return { exitCode: 1, output: "error: no scope ID — run 'orqenix init' first" };
    const remote = flagString(args, "remote");
    const direction = flagString(args, "direction", "outbound") as "outbound" | "inbound";
    if (!remote) return { exitCode: 1, output: "error: --remote is required" };
    const conn = openConn(ctx);
    try {
      const store = new ScopeLinkStore({ conn, localScopeId: ctx.scopeId });
      const updated = store.updateStatus(remote, direction, "revoked");
      return { exitCode: 0, output: json(updated) };
    } finally {
      conn.close();
    }
  },

  "workspace create": async (ctx, args) => {
    if (!ctx.scopeId)
      return { exitCode: 1, output: "error: no scope ID — run 'orqenix init' first" };
    const name = flagString(args, "name");
    if (!name) return { exitCode: 1, output: "error: --name is required" };
    const conn = openConn(ctx);
    try {
      const store = new WorkspaceStore({ conn });
      const ws = store.create({ name, ownerScopeId: ctx.scopeId });
      return { exitCode: 0, output: json(ws) };
    } finally {
      conn.close();
    }
  },

  "workspace list": async (ctx) => {
    if (!ctx.scopeId)
      return { exitCode: 1, output: "error: no scope ID — run 'orqenix init' first" };
    const conn = openConn(ctx);
    try {
      const store = new WorkspaceStore({ conn });
      return { exitCode: 0, output: json(store.listForScope(ctx.scopeId)) };
    } finally {
      conn.close();
    }
  },

  "audit verify": async (ctx) => {
    if (!ctx.scopeId)
      return { exitCode: 1, output: "error: no scope ID — run 'orqenix init' first" };
    const conn = openConn(ctx);
    try {
      const store = new AuditLogStore({ conn, scopeId: ctx.scopeId });
      const result = store.verifyChain();
      return { exitCode: 0, output: json(result) };
    } finally {
      conn.close();
    }
  },

  "audit tail": async (ctx, args) => {
    if (!ctx.scopeId)
      return { exitCode: 1, output: "error: no scope ID — run 'orqenix init' first" };
    const kind = flagString(args, "kind") as AuditEventKind | undefined;
    const limit = Number(flagString(args, "limit", "50"));
    const conn = openConn(ctx);
    try {
      const store = new AuditLogStore({ conn, scopeId: ctx.scopeId });
      const entries = store.list({ kind, limit });
      return { exitCode: 0, output: json(entries.slice(-limit)) };
    } finally {
      conn.close();
    }
  },

  "detach plan": async (ctx, args) => {
    if (!ctx.scopeId)
      return { exitCode: 1, output: "error: no scope ID — run 'orqenix init' first" };
    const kind = flagString(args, "kind");
    const remote = flagString(args, "remote");
    if (!kind)
      return { exitCode: 1, output: "error: --kind is required (unlink-remote | full-detach)" };
    const conn = openConn(ctx);
    try {
      const linkStore = new ScopeLinkStore({ conn, localScopeId: ctx.scopeId });
      const wsStore = new WorkspaceStore({ conn });
      const audit = new AuditLogStore({ conn, scopeId: ctx.scopeId });
      const planner = new DetachPlanner({
        localScopeId: ctx.scopeId,
        linkStore,
        workspaceStore: wsStore,
        auditStore: audit,
      });
      const plan =
        kind === "unlink-remote"
          ? (() => {
              if (!remote) throw new Error("--remote required for unlink-remote");
              return planner.planUnlink(remote);
            })()
          : planner.planFullDetach();
      return { exitCode: 0, output: json(plan) };
    } catch (e) {
      return { exitCode: 1, output: `error: ${(e as Error).message}` };
    } finally {
      conn.close();
    }
  },

  "detach exec": async (ctx, args) => {
    if (!ctx.scopeId)
      return { exitCode: 1, output: "error: no scope ID — run 'orqenix init' first" };
    const kind = flagString(args, "kind");
    const remote = flagString(args, "remote");
    const token = flagString(args, "token");
    const dryRun = flagBool(args, "dry-run", false);
    if (!kind || !token) return { exitCode: 1, output: "error: --kind and --token are required" };
    const conn = openConn(ctx);
    try {
      const linkStore = new ScopeLinkStore({ conn, localScopeId: ctx.scopeId });
      const wsStore = new WorkspaceStore({ conn });
      const audit = new AuditLogStore({ conn, scopeId: ctx.scopeId });
      const planner = new DetachPlanner({
        localScopeId: ctx.scopeId,
        linkStore,
        workspaceStore: wsStore,
        auditStore: audit,
      });
      const executor = new DetachExecutor({
        localScopeId: ctx.scopeId,
        linkStore,
        workspaceStore: wsStore,
        auditStore: audit,
        rootDir: ctx.rootDir,
      });
      const plan =
        kind === "unlink-remote"
          ? (() => {
              if (!remote) throw new Error("--remote required for unlink-remote");
              return planner.planUnlink(remote);
            })()
          : planner.planFullDetach();
      // Caller must have generated their own plan + token; this is a convenience exec where token was
      // produced by `detach plan` immediately prior. We rebuild from the canonical plan to keep tests
      // deterministic; production CLIs should accept a plan file on stdin.
      const report = await executor.execute(plan, token, { dryRun });
      return { exitCode: 0, output: json(report) };
    } catch (e) {
      return { exitCode: 1, output: `error: ${(e as Error).message}` };
    } finally {
      conn.close();
    }
  },

  "migrate up": async (ctx) => {
    const backupDir = `${ctx.rootDir}/.orqenix/backups`;
    const migrator = new PhaseFourToFiveMigrator({ dbPath: ctx.dbPath, backupDir });
    const report = await migrator.migrate();
    return { exitCode: 0, output: json(report) };
  },

  "migrate rollback": async (ctx, args) => {
    const backup = flagString(args, "backup");
    if (!backup) return { exitCode: 1, output: "error: --backup is required" };
    const backupDir = `${ctx.rootDir}/.orqenix/backups`;
    const migrator = new PhaseFourToFiveMigrator({ dbPath: ctx.dbPath, backupDir });
    const report = await migrator.rollback(backup);
    return { exitCode: 0, output: json(report) };
  },

  "migrate status": async (ctx) => {
    const backupDir = `${ctx.rootDir}/.orqenix/backups`;
    const migrator = new PhaseFourToFiveMigrator({ dbPath: ctx.dbPath, backupDir });
    return { exitCode: 0, output: json(migrator.status()) };
  },
};

/**
 * Stub handler for commands not yet implemented.
 * Prints a friendly message and returns exit code 1.
 */
function notImplemented(name: string, comingIn: string, description: string): CommandHandler {
  return async (_ctx: CliContext) => ({
    exitCode: 1,
    output: `"${name}" is not available yet — coming in ${comingIn}. ${description}`,
  });
}

// Stub registrations for commands planned in upcoming releases.
// Removed once each command is implemented.
{
  const coming: [string, string, string][] = [
    ["knowledge index", "v0.10.0", "Index project docs, code, and decisions."],
    ["knowledge query", "v0.10.0", "Query indexed knowledge."],
    ["knowledge status", "v0.10.0", "Show knowledge index status."],
    ["knowledge reindex", "v0.10.0", "Re-index project knowledge."],
    ["memory status", "v0.11.0", "Show memory tier status."],
    ["recall", "v0.11.0", "Recall a memory by reference."],
    ["recall search", "v0.11.0", "Search memory by query."],
    ["mesh status", "v0.12.0", "Show mesh topology and link health."],
    ["mesh query", "v0.12.0", "Query across linked scopes."],
    ["link add", "v0.12.0", "Link another local scope by path."],
    ["scope verify", "v0.12.0", "Verify scope identity and link integrity."],
    ["mp search", "v0.13.0", "Search the marketplace."],
    ["mp install", "v0.13.0", "Install a plugin or skill."],
    ["mp list", "v0.13.0", "List installed plugins."],
    ["gc status", "v0.14.0", "Show garbage-collection status."],
    ["gc run", "v0.14.0", "Run garbage collection."],
    ["trash list", "v0.14.0", "List trashed artifacts."],
    ["history", "v0.14.0", "Show lifecycle history."],
    ["security tokens list", "v0.15.0", "List capability tokens."],
    ["security audit", "v0.15.0", "Show security audit trail."],
    ["config", "v0.16.0", "View or edit configuration."],
  ];
  for (const [name, version, desc] of coming) {
    handlers[name] = notImplemented(name, version, desc);
  }
}

export async function dispatch(ctx: CliContext, args: ParsedArgs): Promise<CliResult> {
  if (args.command.length === 0 || args.command[0]! === "help" || flagBool(args, "help")) {
    return { exitCode: 0, output: usage() };
  }

  // try longest match first (2 tokens then 1)
  const keys = Object.keys(handlers).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const parts = key.split(" ");
    if (parts.length > args.command.length) continue;
    let match = true;
    for (let i = 0; i < parts.length; i++) {
      if (args.command[i]! !== parts[i]!) {
        match = false;
        break;
      }
    }
    if (match) return handlers[key]!(ctx, args);
  }
  return {
    exitCode: 1,
    output: `error: unknown command "${args.command.join(" ")}"\n\n${usage()}`,
  };
}

const COMMAND_META: Record<string, string> = {
  "scope init": "  scope init --name <n>",
  "scope info": "  scope info",
  "link create": "  link create --remote <id> [--direction outbound|inbound]",
  "link list": "  link list [--status active|pending|revoked]",
  "link revoke": "  link revoke --remote <id> [--direction outbound|inbound]",
  "workspace create": "  workspace create --name <n>",
  "workspace list": "  workspace list",
  "audit verify": "  audit verify",
  "audit tail": "  audit tail [--kind <kind>] [--limit 50]",
  "detach plan --kind unlink-remote": "  detach plan --kind unlink-remote --remote <id>",
  "detach plan --kind full-detach": "  detach plan --kind full-detach",
  "detach exec": "  detach exec --kind <kind> [--remote <id>] --token <t> [--dry-run]",
  "migrate up": "  migrate up",
  "migrate rollback": "  migrate rollback --backup <path>",
  "migrate status": "  migrate status",
  version: "  version",
};

export function usage(): string {
  return [`orqenix v${pkg.version}`, "", "Commands:", ...Object.values(COMMAND_META)].join("\n");
}

export { handlers as _commandHandlers };
