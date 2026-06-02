// SPDX-License-Identifier: Apache-2.0
// @bc CS-027 CLI Commands
// @gate G25.1, G25.2, G25.3

import { SqliteConnection, runMigrations } from '@orqenix/storage-sqlite';
import { ScopeLinkStore, SCOPE_LINK_MIGRATIONS } from '@orqenix/scope-link';
import { WorkspaceStore, WORKSPACE_MIGRATIONS } from '@orqenix/workspace';
import { AuditLogStore, AUDIT_LOG_MIGRATIONS } from '@orqenix/audit-log';
import { DetachPlanner, DetachExecutor } from '@orqenix/detach';
import { PhaseFourToFiveMigrator } from '@orqenix/migration';
import { type ParsedArgs, flagString, flagBool } from './parser.js';

export interface CliIO { stdout: (s: string) => void; stderr: (s: string) => void; }
export interface CliContext {
  rootDir: string;
  dbPath: string;
  scopeId: string;
  io: CliIO;
}
export interface CliResult { exitCode: number; output?: string; }
export type CommandHandler = (ctx: CliContext, args: ParsedArgs) => Promise<CliResult>;

function openConn(ctx: CliContext): SqliteConnection {
  const conn = new SqliteConnection({ path: ctx.dbPath });
  runMigrations(conn, [
    ...SCOPE_LINK_MIGRATIONS, ...WORKSPACE_MIGRATIONS, ...AUDIT_LOG_MIGRATIONS,
  ]);
  return conn;
}

function json(value: unknown): string { return JSON.stringify(value, null, 2); }

const handlers: Record<string, CommandHandler> = {
  'version': async (_ctx) => ({
    exitCode: 0,
    output: json({ version: '0.5.0-phase-5', phase: 'Phase 5 Memory Foundation Refactor' }),
  }),

  'scope info': async (ctx) => ({
    exitCode: 0,
    output: json({ scopeId: ctx.scopeId, rootDir: ctx.rootDir, dbPath: ctx.dbPath }),
  }),

  'scope init': async (ctx, args) => {
    const name = flagString(args, 'name');
    if (!name) return { exitCode: 1, output: 'error: --name is required' };
    return { exitCode: 0, output: json({ status: 'scope initialized (stub - see scope-identity.initScope)', name, scopeId: ctx.scopeId }) };
  },

  'link create': async (ctx, args) => {
    const remote = flagString(args, 'remote');
    const direction = flagString(args, 'direction', 'outbound') as 'outbound' | 'inbound';
    if (!remote) return { exitCode: 1, output: 'error: --remote is required' };
    const conn = openConn(ctx);
    try {
      const store = new ScopeLinkStore({ conn, localScopeId: ctx.scopeId });
      const link = store.create({ remoteScopeId: remote, direction });
      return { exitCode: 0, output: json(link) };
    } finally { conn.close(); }
  },

  'link list': async (ctx, args) => {
    const status = flagString(args, 'status') as any;
    const conn = openConn(ctx);
    try {
      const store = new ScopeLinkStore({ conn, localScopeId: ctx.scopeId });
      const links = store.list({ status });
      return { exitCode: 0, output: json(links) };
    } finally { conn.close(); }
  },

  'link revoke': async (ctx, args) => {
    const remote = flagString(args, 'remote');
    const direction = flagString(args, 'direction', 'outbound') as 'outbound' | 'inbound';
    if (!remote) return { exitCode: 1, output: 'error: --remote is required' };
    const conn = openConn(ctx);
    try {
      const store = new ScopeLinkStore({ conn, localScopeId: ctx.scopeId });
      const updated = store.updateStatus(remote, direction, 'revoked');
      return { exitCode: 0, output: json(updated) };
    } finally { conn.close(); }
  },

  'workspace create': async (ctx, args) => {
    const name = flagString(args, 'name');
    if (!name) return { exitCode: 1, output: 'error: --name is required' };
    const conn = openConn(ctx);
    try {
      const store = new WorkspaceStore({ conn });
      const ws = store.create({ name, ownerScopeId: ctx.scopeId });
      return { exitCode: 0, output: json(ws) };
    } finally { conn.close(); }
  },

  'workspace list': async (ctx) => {
    const conn = openConn(ctx);
    try {
      const store = new WorkspaceStore({ conn });
      return { exitCode: 0, output: json(store.listForScope(ctx.scopeId)) };
    } finally { conn.close(); }
  },

  'audit verify': async (ctx) => {
    const conn = openConn(ctx);
    try {
      const store = new AuditLogStore({ conn, scopeId: ctx.scopeId });
      const result = store.verifyChain();
      return { exitCode: 0, output: json(result) };
    } finally { conn.close(); }
  },

  'audit tail': async (ctx, args) => {
    const kind = flagString(args, 'kind') as any;
    const limit = Number(flagString(args, 'limit', '50'));
    const conn = openConn(ctx);
    try {
      const store = new AuditLogStore({ conn, scopeId: ctx.scopeId });
      const entries = store.list({ kind, limit });
      return { exitCode: 0, output: json(entries.slice(-limit)) };
    } finally { conn.close(); }
  },

  'detach plan': async (ctx, args) => {
    const kind = flagString(args, 'kind');
    const remote = flagString(args, 'remote');
    if (!kind) return { exitCode: 1, output: 'error: --kind is required (unlink-remote | full-detach)' };
    const conn = openConn(ctx);
    try {
      const linkStore = new ScopeLinkStore({ conn, localScopeId: ctx.scopeId });
      const wsStore = new WorkspaceStore({ conn });
      const audit = new AuditLogStore({ conn, scopeId: ctx.scopeId });
      const planner = new DetachPlanner({ localScopeId: ctx.scopeId, linkStore, workspaceStore: wsStore, auditStore: audit });
      const plan = kind === 'unlink-remote'
        ? (() => {
            if (!remote) throw new Error('--remote required for unlink-remote');
            return planner.planUnlink(remote);
          })()
        : planner.planFullDetach();
      return { exitCode: 0, output: json(plan) };
    } catch (e) {
      return { exitCode: 1, output: `error: ${(e as Error).message}` };
    } finally { conn.close(); }
  },

  'detach exec': async (ctx, args) => {
    const kind = flagString(args, 'kind');
    const remote = flagString(args, 'remote');
    const token = flagString(args, 'token');
    const dryRun = flagBool(args, 'dry-run', false);
    if (!kind || !token) return { exitCode: 1, output: 'error: --kind and --token are required' };
    const conn = openConn(ctx);
    try {
      const linkStore = new ScopeLinkStore({ conn, localScopeId: ctx.scopeId });
      const wsStore = new WorkspaceStore({ conn });
      const audit = new AuditLogStore({ conn, scopeId: ctx.scopeId });
      const planner = new DetachPlanner({ localScopeId: ctx.scopeId, linkStore, workspaceStore: wsStore, auditStore: audit });
      const executor = new DetachExecutor({ localScopeId: ctx.scopeId, linkStore, workspaceStore: wsStore, auditStore: audit, rootDir: ctx.rootDir });
      const plan = kind === 'unlink-remote'
        ? (() => {
            if (!remote) throw new Error('--remote required for unlink-remote');
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
    } finally { conn.close(); }
  },

  'migrate up': async (ctx) => {
    const backupDir = `${ctx.rootDir}/.orqenix/backups`;
    const migrator = new PhaseFourToFiveMigrator({ dbPath: ctx.dbPath, backupDir });
    const report = await migrator.migrate();
    return { exitCode: 0, output: json(report) };
  },

  'migrate rollback': async (ctx, args) => {
    const backup = flagString(args, 'backup');
    if (!backup) return { exitCode: 1, output: 'error: --backup is required' };
    const backupDir = `${ctx.rootDir}/.orqenix/backups`;
    const migrator = new PhaseFourToFiveMigrator({ dbPath: ctx.dbPath, backupDir });
    const report = await migrator.rollback(backup);
    return { exitCode: 0, output: json(report) };
  },

  'migrate status': async (ctx) => {
    const backupDir = `${ctx.rootDir}/.orqenix/backups`;
    const migrator = new PhaseFourToFiveMigrator({ dbPath: ctx.dbPath, backupDir });
    return { exitCode: 0, output: json(migrator.status()) };
  },
};

export async function dispatch(ctx: CliContext, args: ParsedArgs): Promise<CliResult> {
  if (args.command.length === 0 || (args.command[0]! === 'help') || flagBool(args, 'help')) {
    return { exitCode: 0, output: usage() };
  }

  // try longest match first (2 tokens then 1)
  const keys = Object.keys(handlers).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const parts = key.split(' ');
    if (parts.length > args.command.length) continue;
    let match = true;
    for (let i = 0; i < parts.length; i++) {
      if (args.command[i]! !== parts[i]!) { match = false; break; }
    }
    if (match) return handlers[key]!(ctx, args);
  }
  return { exitCode: 1, output: `error: unknown command "${args.command.join(' ')}"\n\n${usage()}` };
}

export function usage(): string {
  return [
    'orqenix v0.5.0-phase-5',
    '',
    'Commands:',
    '  scope init --name <n>',
    '  scope info',
    '  link create --remote <id> [--direction outbound|inbound]',
    '  link list [--status active|pending|revoked]',
    '  link revoke --remote <id> [--direction outbound|inbound]',
    '  workspace create --name <n>',
    '  workspace list',
    '  audit verify',
    '  audit tail [--kind <kind>] [--limit 50]',
    '  detach plan --kind unlink-remote --remote <id>',
    '  detach plan --kind full-detach',
    '  detach exec --kind <kind> [--remote <id>] --token <t> [--dry-run]',
    '  migrate up',
    '  migrate rollback --backup <path>',
    '  migrate status',
    '  version',
  ].join('\n');
}

export { handlers as _commandHandlers };
