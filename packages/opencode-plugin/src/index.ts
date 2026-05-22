import { detectGitInfo, detectSession, generateScopeId, log } from "@orqenix/core";

type OpenCodePluginContext = {
  project?: { directory?: string };
  directory?: string;
  worktree?: string;
};

type OpenCodePluginHooks = Record<string, (...args: any[]) => any | Promise<any>>;

export default async function OrqenixOpenCodePlugin(
  ctx: OpenCodePluginContext,
): Promise<OpenCodePluginHooks> {
  const cwd = ctx.project?.directory ?? ctx.directory ?? process.cwd();
  log.info("opencode-plugin: initialized", { cwd });

  return {
    "session.start": async (session: { id: string }) => {
      try {
        const git = await detectGitInfo(cwd);
        const sessionId = `oc-${session.id}`;
        if (git) {
          const scope = generateScopeId({
            project: git.repoRoot,
            branch: git.branch,
            worktree: git.worktreePath,
            session: sessionId,
          });
          log.info("opencode-plugin: bound session to scope", {
            session: sessionId,
            scope: scope.short,
          });
        } else {
          log.info("opencode-plugin: session started outside git", { session: sessionId });
        }
      } catch (err) {
        log.warn("opencode-plugin: session.start failed", { err: String(err) });
      }
    },

    "tool.execute.before": async (input: { tool?: string }) => {
      log.debug("opencode-plugin: tool.execute.before", { tool: input.tool });
    },

    "tool.execute.after": async (input: { tool?: string }, output: unknown) => {
      log.debug("opencode-plugin: tool.execute.after", {
        tool: input.tool,
        hasOutput: !!output,
      });
    },
  };
}

export { OrqenixOpenCodePlugin };
