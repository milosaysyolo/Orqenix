import type { OrqenixPlugin, Task, TaskResult } from "@orqenix/core/plugin";

interface AgentManifest {
  knowledge_briefing?: boolean;
  briefing_kbs?: Array<"decisions" | "docs" | "code">;
  briefing_max_tokens?: number;
  capture_decisions?: boolean;
  reindex_after?: "auto" | "code" | "docs" | "both" | "none";
  writes?: Array<"code" | "docs" | "tests" | "config">;
}

interface AgentResolver {
  getManifest(agentName: string): AgentManifest | undefined;
}

interface KnowledgeApi {
  queryBriefing(input: {
    text: string;
    kbs: Array<"decisions" | "docs" | "code">;
    maxTokens: number;
  }): Promise<string>;
  appendDecisions(decisions: Array<{ type: string; summary: string }>): Promise<void>;
  reindex(paths: { docs?: string[]; code?: string[] }): Promise<void>;
}

interface FilesystemDetector {
  detectChanges(scope: unknown, sinceMs: number): Promise<{ docs: string[]; code: string[] }>;
}

export interface KnowledgeWorkflowDeps {
  agents: AgentResolver;
  knowledge: KnowledgeApi;
  fs: FilesystemDetector;
}

export function createKnowledgeWorkflowPlugin(deps: KnowledgeWorkflowDeps): OrqenixPlugin {
  return {
    name: "knowledge-workflow",
    version: "0.2.0-dev",
    description: "Auto-query KB before tasks; auto-reindex after",
    priority: 80,
    capabilities: ["knowledge-workflow", "agent-agnostic"],
    hooks: {
      "agent.task.before": async (task: Task, ctx) => {
        const manifest = deps.agents.getManifest(task.agentName) ?? {};
        if (manifest.knowledge_briefing === false) return;
        const kbs = manifest.briefing_kbs ?? ["decisions", "docs", "code"];
        const maxTokens = manifest.briefing_max_tokens ?? 3000;
        try {
          const briefing = await deps.knowledge.queryBriefing({
            text: task.intent,
            kbs,
            maxTokens,
          });
          if (briefing) {
            task.context.systemPrelude = (task.context.systemPrelude ?? "") + "\n\n" + briefing;
            ctx.log.debug("knowledge-workflow: briefing injected", {
              agent: task.agentName,
              bytes: briefing.length,
            });
          }
        } catch (err) {
          ctx.log.warn("knowledge-workflow: briefing failed", { err: String(err) });
        }
      },

      "agent.task.after": async (task: Task, result: TaskResult, ctx) => {
        const manifest = deps.agents.getManifest(task.agentName) ?? {};
        const policy = manifest.reindex_after ?? "auto";
        if (policy === "none") return;

        try {
          const changes = await deps.fs.detectChanges(task.scope, task.startTime);
          const toReindex: { docs?: string[]; code?: string[] } = {};
          if (policy === "auto" || policy === "docs" || policy === "both") {
            if (changes.docs.length) toReindex.docs = changes.docs;
          }
          if (policy === "auto" || policy === "code" || policy === "both") {
            if (changes.code.length) toReindex.code = changes.code;
          }
          if (toReindex.docs || toReindex.code) {
            await deps.knowledge.reindex(toReindex);
            ctx.log.debug("knowledge-workflow: reindex queued", toReindex);
          }
          if (
            manifest.capture_decisions !== false &&
            result.decisions &&
            result.decisions.length > 0
          ) {
            await deps.knowledge.appendDecisions(result.decisions);
          }
        } catch (err) {
          ctx.log.warn("knowledge-workflow: post-task failed", { err: String(err) });
        }
      },
    },
  };
}

export function noopDeps(): KnowledgeWorkflowDeps {
  return {
    agents: { getManifest: () => undefined },
    knowledge: {
      async queryBriefing() {
        return "";
      },
      async appendDecisions() {
        /* noop */
      },
      async reindex() {
        /* noop */
      },
    },
    fs: {
      async detectChanges() {
        return { docs: [], code: [] };
      },
    },
  };
}
