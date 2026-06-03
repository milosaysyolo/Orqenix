import { z } from "zod";
import { OrqenixError } from "@orqenix/core";

export const RtkConfigSchema = z
  .object({
    maxStdoutBytes: z
      .number()
      .int()
      .min(1024)
      .max(10 * 1024 * 1024)
      .default(256 * 1024),
    maxStderrBytes: z
      .number()
      .int()
      .min(1024)
      .max(10 * 1024 * 1024)
      .default(256 * 1024),
    timeoutMs: z
      .number()
      .int()
      .positive()
      .max(60 * 60 * 1000)
      .default(60_000),
    blockedCommands: z
      .array(z.string())
      .default(["rm", "rmdir", "shutdown", "reboot", "mkfs", "dd"]),
    redactRegexes: z
      .array(z.string())
      .default([
        "(?i)(api[_-]?key|token|secret|password)[=:][^\\s]+",
        "(?i)Bearer\\s+[A-Za-z0-9._-]+",
      ]),
  })
  .strict();
export type RtkConfig = z.infer<typeof RtkConfigSchema>;

export interface RtkCommandResult {
  cmd: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  truncatedStdout: boolean;
  truncatedStderr: boolean;
  blocked: boolean;
  timedOut: boolean;
}

export class RtkBlockedCommandError extends OrqenixError {
  constructor(cmd: string) {
    super(`command "${cmd}" is in blocked list`, "RTK_BLOCKED");
  }
}
export class RtkTimeoutError extends OrqenixError {
  constructor(ms: number) {
    super(`shell command timed out after ${ms}ms`, "RTK_TIMEOUT");
  }
}
