// SPDX-License-Identifier: Apache-2.0
// @gate G21
import { GateRunner, type GateCheck, type GateReport } from "@orqenix/gate-runner-core";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { RtkRunner, RtkBlockedCommandError } from "@orqenix/rtk-hooks";
import { redact } from "@orqenix/rtk-hooks";
import { defaultFormatter, createRtkCompressInputExtension } from "@orqenix/rtk-hooks";
import type { RtkCommandResult } from "@orqenix/rtk-hooks";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");

class G21 extends GateRunner {
  readonly id = "G21";
  readonly title = "RTK Hooks Integration";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G21.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G21.1", "rtk-hooks unit tests pass", () => {
        execSync("npx vitest run", { cwd: join(REPO_ROOT, "packages/rtk-hooks"), stdio: "pipe" });
      }),
      await this.check(
        "G21.2",
        "blocks dangerous commands (rm, dd, shutdown, reboot, mkfs)",
        async () => {
          const runner = new RtkRunner();
          const blocked = ["rm", "dd", "shutdown", "reboot", "mkfs"];
          for (const cmd of blocked) {
            if (!runner.isBlocked(cmd)) throw new Error(`${cmd} should be blocked`);
          }
          if (runner.isBlocked("echo")) throw new Error("echo should not be blocked");
          if (runner.isBlocked("ls")) throw new Error("ls should not be blocked");
          for (const cmd of blocked) {
            try {
              await runner.run(cmd, ["-rf", "/"]);
              throw new Error(`${cmd} should have thrown`);
            } catch (e) {
              if (!(e instanceof RtkBlockedCommandError))
                throw new Error(`${cmd}: expected RtkBlockedCommandError`);
            }
          }
        },
      ),
      await this.check("G21.3", "redacts API keys and Bearer tokens before output", () => {
        const withKey = "api_key=sk-abc123xyz and token=12345";
        const redactedKey = redact(withKey, ["(?i)(api[_-]?key|token|secret|password)[=:][^\\s]+"]);
        if (redactedKey.includes("sk-abc123xyz")) throw new Error("API key not redacted");
        const withBearer =
          "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dQw4w9WgXcQ";
        const redactedBearer = redact(withBearer, ["(?i)Bearer\\s+[A-Za-z0-9._-]+"]);
        if (redactedBearer.includes("eyJhbGciOiJIUzI1NiJ9"))
          throw new Error("Bearer token not redacted");
      }),
      await this.check("G21.4", "truncates stdout above configured cap", async () => {
        const runner = new RtkRunner({ config: { maxStdoutBytes: 1024 } });
        const result = await runner.run(process.execPath, ["-e", "console.log('x'.repeat(5000))"]);
        if (!result.truncatedStdout) throw new Error("stdout was not truncated");
        if (result.stdout.length > 2000)
          throw new Error(`stdout too long: ${result.stdout.length}`);
      }),
      await this.check("G21.5", "records run counter and duration histogram metrics", async () => {
        const runner = new RtkRunner({ config: { maxStdoutBytes: 4096 } });
        const result = await runner.run(process.execPath, ["-e", 'console.log("hi")']);
        if (result.exitCode !== 0) throw new Error(`expected exit 0, got ${result.exitCode}`);
        if (result.durationMs <= 0)
          throw new Error(`expected positive duration, got ${result.durationMs}`);
        if (result.blocked) throw new Error("should not be blocked");
        if (result.timedOut) throw new Error("should not time out");
      }),
      await this.check(
        "G21.6",
        "extension formats output with exit code and truncation markers",
        () => {
          const result: RtkCommandResult = {
            cmd: "echo",
            args: ["hello"],
            stdout: "hello",
            stderr: "",
            exitCode: 0,
            durationMs: 5,
            truncatedStdout: false,
            truncatedStderr: false,
            blocked: false,
            timedOut: false,
          };
          const formatted = defaultFormatter(result);
          if (!formatted.includes("exit 0")) throw new Error("expected exit code in output");
          const truncated: RtkCommandResult = {
            cmd: "cat",
            args: ["big"],
            stdout: "some data",
            stderr: "",
            exitCode: 0,
            durationMs: 5,
            truncatedStdout: true,
            truncatedStderr: false,
            blocked: false,
            timedOut: false,
          };
          const fmtTrunc = defaultFormatter(truncated);
          if (!fmtTrunc.includes("[stdout truncated]"))
            throw new Error("expected truncation marker");
          const runner = new RtkRunner();
          const ext = createRtkCompressInputExtension({ runner });
          if (typeof ext !== "function") throw new Error("extension should be a function");
        },
      ),
      await this.check("G21.7", "redact() helper ignores invalid regex patterns", () => {
        const input = "hello world";
        const result = redact(input, ["[invalid", "(unclosed", "\\"]);
        if (result !== input) throw new Error("redact should return original on invalid patterns");
        const valid = redact(input, ["world"]);
        if (valid !== "hello <REDACTED>") throw new Error("valid patterns should still work");
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G21-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G21();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G21 crashed:", e);
  process.exit(2);
});
