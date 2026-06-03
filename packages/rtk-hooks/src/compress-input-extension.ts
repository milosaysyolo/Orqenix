import type { RtkCommandResult } from "./contracts.js";
import type { RtkRunner } from "./runner.js";

export interface RtkInput {
  cmd?: string;
  args?: string[];
  cwd?: string;
}

export interface RtkExtensionOutput {
  injected: string | null;
  result?: RtkCommandResult;
}

export type RtkResultFormatter = (r: RtkCommandResult) => string;

export function defaultFormatter(r: RtkCommandResult): string {
  const lines: string[] = [];
  lines.push(`$ ${r.cmd} ${r.args.join(" ")}`.trim());
  if (r.stdout) lines.push(r.stdout.trimEnd());
  if (r.truncatedStdout) lines.push(`[stdout truncated]`);
  if (r.stderr) lines.push(`[stderr]\n${r.stderr.trimEnd()}`);
  if (r.truncatedStderr) lines.push(`[stderr truncated]`);
  if (r.timedOut) lines.push(`[timed out]`);
  else lines.push(`[exit ${r.exitCode ?? "?"}]`);
  return lines.join("\n");
}

export interface CreateRtkExtensionOptions {
  runner: RtkRunner;
  formatter?: RtkResultFormatter;
}

export function createRtkCompressInputExtension(opts: CreateRtkExtensionOptions) {
  const fmt = opts.formatter ?? defaultFormatter;
  return async (input: RtkInput): Promise<RtkExtensionOutput> => {
    if (!input.cmd) return { injected: null };
    const result = await opts.runner.run(input.cmd, input.args ?? [], { cwd: input.cwd });
    return { injected: fmt(result), result };
  };
}
