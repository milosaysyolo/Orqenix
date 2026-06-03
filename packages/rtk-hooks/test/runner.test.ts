import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { RtkRunner, RtkBlockedCommandError, redact, createRtkCompressInputExtension } from "../src";
import { MetricsRegistry } from "@orqenix/telemetry";

function streamOf(text: string): Readable {
  const r = new Readable();
  r._read = () => {};
  setImmediate(() => {
    r.push(Buffer.from(text));
    r.push(null);
  });
  return r;
}

function fakeChild(stdout: string, stderr: string, exitCode: number, delayMs = 5) {
  const ee = new EventEmitter() as any;
  ee.stdout = streamOf(stdout);
  ee.stderr = streamOf(stderr);
  ee.kill = () => {};
  setTimeout(() => ee.emit("exit", exitCode), delayMs);
  return ee;
}

const fakeSpawn = (stdout = "hello\n", stderr = "", exitCode = 0, delayMs = 5) =>
  ((_cmd: string, _args?: ReadonlyArray<string>, _opts?: any) =>
    fakeChild(stdout, stderr, exitCode, delayMs)) as any;

describe("RtkRunner", () => {
  it("runs a simple command and captures stdout", async () => {
    const r = new RtkRunner({ spawnImpl: fakeSpawn("hello world\n", "", 0) });
    const out = await r.run("echo", ["hi"]);
    expect(out.stdout.trim()).toBe("hello world");
    expect(out.exitCode).toBe(0);
    expect(out.timedOut).toBe(false);
  });

  it("blocks dangerous commands", async () => {
    const r = new RtkRunner({ spawnImpl: fakeSpawn() });
    await expect(r.run("rm", ["-rf", "/"])).rejects.toThrow(RtkBlockedCommandError);
  });

  it("truncates stdout above maxStdoutBytes", async () => {
    const r = new RtkRunner({
      config: { maxStdoutBytes: 1024 },
      spawnImpl: fakeSpawn("A".repeat(2000), "", 0),
    });
    const out = await r.run("echo");
    expect(out.truncatedStdout).toBe(true);
    expect(out.stdout.length).toBeLessThanOrEqual(1024);
  });

  it("redacts API keys in output", async () => {
    const r = new RtkRunner({ spawnImpl: fakeSpawn("api_key=sk-abc123\n", "", 0) });
    const out = await r.run("echo");
    expect(out.stdout).toContain("<REDACTED>");
    expect(out.stdout).not.toContain("sk-abc123");
  });

  it("records metrics", async () => {
    const metrics = new MetricsRegistry();
    const r = new RtkRunner({ metrics, spawnImpl: fakeSpawn() });
    await r.run("echo");
    const snap = metrics.snapshot();
    expect(snap.counters.find((c) => c.name === "orqenix.rtk.cmd_runs")?.value).toBe(1);
    expect(snap.histograms.find((h) => h.name === "orqenix.rtk.cmd_duration_ms")?.count).toBe(1);
  });

  it("records failure metric on non-zero exit", async () => {
    const metrics = new MetricsRegistry();
    const r = new RtkRunner({ metrics, spawnImpl: fakeSpawn("", "err", 1) });
    await r.run("false");
    const snap = metrics.snapshot();
    expect(snap.counters.find((c) => c.name === "orqenix.rtk.cmd_failures")?.value).toBe(1);
  });

  it("handles spawn errors gracefully", async () => {
    const r = new RtkRunner({
      spawnImpl: (() => {
        throw new Error("ENOENT");
      }) as any,
    });
    const out = await r.run("nonexistent-binary");
    expect(out.exitCode).toBeNull();
    expect(out.stderr).toContain("ENOENT");
  });

  it("isBlocked basename match", () => {
    const r = new RtkRunner({ spawnImpl: fakeSpawn() });
    expect(r.isBlocked("/usr/bin/rm")).toBe(true);
    expect(r.isBlocked("ls")).toBe(false);
  });
});

describe("redact", () => {
  it("redacts patterns and leaves rest untouched", () => {
    const out = redact("safe text Bearer abcdef.GHIJ-123 also api_key=secret", [
      "(?i)Bearer\\s+[A-Za-z0-9._-]+",
      "(?i)(api[_-]?key|token|secret|password)[=:][^\\s]+",
    ]);
    expect(out).toContain("safe text");
    expect(out).not.toContain("abcdef.GHIJ-123");
    expect(out).not.toContain("secret");
  });

  it("ignores invalid regex", () => {
    expect(() => redact("x", ["(?invalid"])).not.toThrow();
  });
});

describe("createRtkCompressInputExtension", () => {
  it("runs command and formats output", async () => {
    const runner = new RtkRunner({ spawnImpl: fakeSpawn("hello\n", "", 0) });
    const ext = createRtkCompressInputExtension({ runner });
    const out = await ext({ cmd: "echo", args: ["hi"] });
    expect(out.injected).toContain("$ echo hi");
    expect(out.injected).toContain("hello");
    expect(out.injected).toContain("[exit 0]");
  });

  it("returns null when no cmd provided", async () => {
    const runner = new RtkRunner({ spawnImpl: fakeSpawn() });
    const ext = createRtkCompressInputExtension({ runner });
    const out = await ext({});
    expect(out.injected).toBeNull();
  });

  it("includes truncation markers in formatted output", async () => {
    const runner = new RtkRunner({
      config: { maxStdoutBytes: 1024 },
      spawnImpl: fakeSpawn("A".repeat(2000), "", 0),
    });
    const ext = createRtkCompressInputExtension({ runner });
    const out = await ext({ cmd: "echo" });
    expect(out.injected).toContain("[stdout truncated]");
  });
});
