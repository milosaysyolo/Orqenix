import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectGitInfo } from "../src/scope/git-info.js";

describe("detectGitInfo", () => {
  it("returns null outside a git repo", async () => {
    const dir = mkdtempSync(join(tmpdir(), "orqenix-nogit-"));
    const info = await detectGitInfo(dir);
    expect(info).toBeNull();
  });

  it("detects repo root and branch from .git directory", async () => {
    const repo = mkdtempSync(join(tmpdir(), "orqenix-gitrepo-"));
    mkdirSync(join(repo, ".git"), { recursive: true });
    writeFileSync(join(repo, ".git", "HEAD"), "ref: refs/heads/main\n");
    const info = await detectGitInfo(repo);
    expect(info).not.toBeNull();
    expect(info!.branch).toBe("main");
    expect(info!.repoRoot).toBeTruthy();
  });

  it("walks up to find .git from subdirectory", async () => {
    const repo = mkdtempSync(join(tmpdir(), "orqenix-gitrepo-"));
    mkdirSync(join(repo, ".git"), { recursive: true });
    writeFileSync(join(repo, ".git", "HEAD"), "ref: refs/heads/dev\n");
    const sub = join(repo, "src", "deep");
    mkdirSync(sub, { recursive: true });
    const info = await detectGitInfo(sub);
    expect(info!.branch).toBe("dev");
  });

  it("handles detached HEAD", async () => {
    const repo = mkdtempSync(join(tmpdir(), "orqenix-detached-"));
    mkdirSync(join(repo, ".git"), { recursive: true });
    writeFileSync(join(repo, ".git", "HEAD"), "abc123def456\n");
    const info = await detectGitInfo(repo);
    expect(info!.branch).toBe("abc123de");
  });
});
