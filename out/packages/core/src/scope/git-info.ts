import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";

export interface GitInfo {
  repoRoot: string;
  branch: string;
  worktreePath: string;
}

/**
 * Detect git repo root, current branch, and worktree path from cwd.
 * Walks up the directory tree to find .git, supports worktrees.
 * Uses .git filesystem directly (no spawn) for cross-platform reliability.
 *
 * @param cwd - Directory to start searching from (default: process.cwd())
 * @returns GitInfo object with repoRoot, branch, worktreePath, or null if not in a git repo
 */
export async function detectGitInfo(cwd: string = process.cwd()): Promise<GitInfo | null> {
  const cur = resolve(cwd);
  let dir = cur;
  while (true) {
    const gitPath = join(dir, ".git");
    if (existsSync(gitPath)) {
      return await readGitDir(dir, gitPath);
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

async function readGitDir(repoRoot: string, gitPath: string): Promise<GitInfo> {
  // .git can be a directory OR a file (worktree).
  let gitDir = gitPath;
  let worktreePath = repoRoot;

  const stat = await import("node:fs/promises").then((f) => f.stat(gitPath));
  if (stat.isFile()) {
    // worktree: file contains "gitdir: <path>"
    const content = (await readFile(gitPath, "utf-8")).trim();
    const match = content.match(/^gitdir:\s*(.+)$/);
    if (match && match[1]) {
      gitDir = normalize(resolve(repoRoot, match[1]));
      worktreePath = repoRoot;
    }
  }

  // Read HEAD to get branch
  let branch = "HEAD";
  try {
    const headPath = join(gitDir, "HEAD");
    if (existsSync(headPath)) {
      const head = (await readFile(headPath, "utf-8")).trim();
      const m = head.match(/^ref:\s*refs\/heads\/(.+)$/);
      branch = m && m[1] ? m[1] : head.slice(0, 8);
    }
  } catch {
    /* default branch HEAD */
  }

  return { repoRoot: normalize(repoRoot), branch, worktreePath: normalize(worktreePath) };
}
