import { defineCommand } from "citty";
import consola from "consola";
import { detectGitInfo, detectSession, generateScopeId } from "@orqenix/core/scope";

export const scopeCmd = defineCommand({
  meta: { name: "scope", description: "Manage scopes" },
  subCommands: {
    current: defineCommand({
      meta: { name: "current", description: "Show the current scope" },
      async run() {
        const git = await detectGitInfo();
        if (!git) {
          consola.error("Not inside a git repo");
          return;
        }
        const session = await detectSession();
        const scope = generateScopeId({
          project: git.repoRoot,
          branch: git.branch,
          worktree: git.worktreePath,
          session,
        });
        consola.log(JSON.stringify(scope, null, 2));
      },
    }),
  },
});
