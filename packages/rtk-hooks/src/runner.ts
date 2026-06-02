import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { basename } from 'node:path';
import type { HookBus } from '@orqenix/hooks';
import type { MetricsRegistry } from '@orqenix/telemetry';
import {
  RtkConfigSchema, RtkBlockedCommandError,
  type RtkCommandResult, type RtkConfig,
} from './contracts.js';
import { redact } from './redaction.js';

type SpawnFn = typeof nodeSpawn;

export interface RtkRunnerOptions {
  config?: Partial<RtkConfig>;
  bus?: HookBus;
  metrics?: MetricsRegistry;
  scopeId?: string;
  spawnImpl?: SpawnFn;
}

export interface RtkRunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export class RtkRunner {
  private readonly cfg: RtkConfig;
  private readonly metrics?: MetricsRegistry;
  private readonly scopeId: string;
  private readonly spawnImpl: SpawnFn;

  constructor(opts: RtkRunnerOptions = {}) {
    this.cfg = RtkConfigSchema.parse(opts.config ?? {});
    this.metrics = opts.metrics;
    this.scopeId = opts.scopeId ?? 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    this.spawnImpl = opts.spawnImpl ?? nodeSpawn;
  }

  isBlocked(cmd: string): boolean {
    const name = basename(cmd);
    return this.cfg.blockedCommands.includes(name);
  }

  async run(cmd: string, args: string[] = [], opts: RtkRunOptions = {}): Promise<RtkCommandResult> {
    const started = Date.now();
    if (this.isBlocked(cmd)) {
      this.metrics?.counter('orqenix.rtk.cmd_failures', { scope: this.scopeId, cmd, reason: 'blocked' }).inc();
      throw new RtkBlockedCommandError(cmd);
    }

    let child: ChildProcess;
    try {
      child = this.spawnImpl(cmd, args, { cwd: opts.cwd, env: opts.env, shell: false });
    } catch (e) {
      this.metrics?.counter('orqenix.rtk.cmd_failures', { scope: this.scopeId, cmd, reason: 'spawn' }).inc();
      return {
        cmd, args, stdout: '', stderr: (e as Error).message,
        exitCode: null, durationMs: Date.now() - started,
        truncatedStdout: false, truncatedStderr: false,
        blocked: false, timedOut: false,
      };
    }

    let stdoutBytes = 0, stderrBytes = 0;
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let truncatedStdout = false, truncatedStderr = false;

    child.stdout?.on('data', (chunk: Buffer) => {
      if (truncatedStdout) return;
      const remain = this.cfg.maxStdoutBytes - stdoutBytes;
      if (remain <= 0) { truncatedStdout = true; return; }
      if (chunk.length > remain) {
        stdoutChunks.push(chunk.subarray(0, remain));
        stdoutBytes += remain;
        truncatedStdout = true;
      } else {
        stdoutChunks.push(chunk);
        stdoutBytes += chunk.length;
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      if (truncatedStderr) return;
      const remain = this.cfg.maxStderrBytes - stderrBytes;
      if (remain <= 0) { truncatedStderr = true; return; }
      if (chunk.length > remain) {
        stderrChunks.push(chunk.subarray(0, remain));
        stderrBytes += remain;
        truncatedStderr = true;
      } else {
        stderrChunks.push(chunk);
        stderrBytes += chunk.length;
      }
    });

    let timedOut = false;
    const killTimer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
    }, this.cfg.timeoutMs);

    const exitCode: number | null = await new Promise((res) => {
      child.on('exit', (code) => res(code));
      child.on('error', () => res(null));
    });
    clearTimeout(killTimer);

    const stdoutRaw = Buffer.concat(stdoutChunks).toString('utf-8');
    const stderrRaw = Buffer.concat(stderrChunks).toString('utf-8');
    const stdout = redact(stdoutRaw, this.cfg.redactRegexes);
    const stderr = redact(stderrRaw, this.cfg.redactRegexes);
    const durationMs = Date.now() - started;

    this.metrics?.counter('orqenix.rtk.cmd_runs', { scope: this.scopeId, cmd }).inc();
    this.metrics?.histogram('orqenix.rtk.cmd_duration_ms', { scope: this.scopeId, cmd }).observe(durationMs);
    if (exitCode === null || (exitCode !== 0 && !timedOut)) {
      this.metrics?.counter('orqenix.rtk.cmd_failures', { scope: this.scopeId, cmd, reason: 'exit' }).inc();
    }
    if (timedOut) {
      this.metrics?.counter('orqenix.rtk.cmd_failures', { scope: this.scopeId, cmd, reason: 'timeout' }).inc();
    }

    return {
      cmd, args, stdout, stderr,
      exitCode: timedOut ? null : exitCode,
      durationMs, truncatedStdout, truncatedStderr,
      blocked: false, timedOut,
    };
  }
}
