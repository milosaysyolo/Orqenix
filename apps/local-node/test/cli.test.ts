import { describe, it, expect, vi } from "vitest";
import { parseCli } from "../src/cli.js";

describe("parseCli", () => {
  it("defaults to help when no command", () => {
    const r = parseCli([]);
    expect(r.cmd).toBe("help");
    expect(r.configDir).toBe(".orqenix");
  });

  it("parses start with default config dir", () => {
    const r = parseCli(["start"]);
    expect(r.cmd).toBe("start");
    expect(r.configDir).toBe(".orqenix");
  });

  it("parses status with explicit --config", () => {
    const r = parseCli(["status", "--config", "/tmp/orq"]);
    expect(r.cmd).toBe("status");
    expect(r.configDir).toBe("/tmp/orq");
  });

  it("parses verify", () => {
    const r = parseCli(["verify"]);
    expect(r.cmd).toBe("verify");
  });

  it("parses version", () => {
    const r = parseCli(["version"]);
    expect(r.cmd).toBe("version");
  });

  it("treats unknown command as help", () => {
    const r = parseCli(["frobnicate"]);
    expect(r.cmd).toBe("help");
  });

  it("accepts -c short flag for config", () => {
    const r = parseCli(["start", "-c", "/etc/orqenix"]);
    expect(r.configDir).toBe("/etc/orqenix");
  });
});

describe("CLI integration smoke", () => {
  it("version prints to stdout", async () => {
    const { runCli } = await import("../src/cli.js");
    const stdout: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((s: string | Uint8Array) => {
      stdout.push(typeof s === "string" ? s : Buffer.from(s).toString("utf8"));
      return true;
    }) as typeof process.stdout.write;
    try {
      await runCli(["version"]);
      expect(stdout.join("")).toMatch(/orqenix-node 0\.6\.0-phase-6/);
    } finally {
      process.stdout.write = orig;
    }
  });

  it("help prints usage with all commands listed", async () => {
    const { runCli } = await import("../src/cli.js");
    const stdout: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((s: string | Uint8Array) => {
      stdout.push(typeof s === "string" ? s : Buffer.from(s).toString("utf8"));
      return true;
    }) as typeof process.stdout.write;
    try {
      await runCli(["help"]);
      const out = stdout.join("");
      expect(out).toMatch(/start/);
      expect(out).toMatch(/status/);
      expect(out).toMatch(/verify/);
      expect(out).toMatch(/version/);
    } finally {
      process.stdout.write = orig;
    }
  });
});
