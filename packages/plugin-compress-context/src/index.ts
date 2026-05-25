import type { OrqenixPlugin } from "@orqenix/core/plugin";

export type CompressContextMode = "smart" | "aggressive" | "manual";

export interface CompressContextConfig {
  enabled: boolean;
  mode: CompressContextMode;
  minTokensTrigger: number;
  maxTokensTrigger: number;
  triggers: {
    onTaskComplete: boolean;
    onMilestone: boolean;
    onContextPressure: boolean;
    onTopicShift: boolean;
    onIdle: boolean;
  };
  preserve: {
    decisionKB: boolean;
    docsKB: boolean;
    codeKB: boolean;
    userMessages: boolean;
    checkpoints: boolean;
    protectedTags: boolean;
  };
  protectPatterns: string[];
}

const DEFAULT_CONFIG: CompressContextConfig = {
  enabled: true,
  mode: "smart",
  minTokensTrigger: 20000,
  maxTokensTrigger: 100000,
  triggers: {
    onTaskComplete: true,
    onMilestone: true,
    onContextPressure: true,
    onTopicShift: true,
    onIdle: false,
  },
  preserve: {
    decisionKB: true,
    docsKB: false,
    codeKB: false,
    userMessages: false,
    checkpoints: true,
    protectedTags: true,
  },
  protectPatterns: ["AGENTS.md", "*.spec.md", ".orqenix/**", "<protect>...</protect>"],
};

export interface ConversationMessage {
  role: string;
  content: string;
  timestamp?: number;
  taskId?: string;
  isCheckpoint?: boolean;
  isDecision?: boolean;
  isUserMessage?: boolean;
  isProtected?: boolean;
  metadata?: Record<string, unknown>;
}

export function estimateMessagesTokens(messages: ConversationMessage[]): number {
  return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
}

export function shouldTriggerCompression(
  messages: ConversationMessage[],
  config: CompressContextConfig,
  event: keyof CompressContextConfig["triggers"],
  contextLimit: number,
): boolean {
  if (!config.enabled) return false;
  if (config.mode === "manual") return false;

  const tokens = estimateMessagesTokens(messages);

  if (tokens >= config.maxTokensTrigger) return true;
  if (tokens < config.minTokensTrigger) return false;

  if (event === "onContextPressure" && tokens >= contextLimit * 0.7) {
    return config.triggers.onContextPressure;
  }

  return config.triggers[event];
}

export interface CompressionResult {
  compressed: ConversationMessage[];
  removed: number;
  tokensSaved: number;
  preservedCount: number;
}

export function compressRange(
  messages: ConversationMessage[],
  startIdx: number,
  endIdx: number,
  config: CompressContextConfig,
): CompressionResult {
  const target = messages.slice(startIdx, endIdx);
  const preserved: ConversationMessage[] = [];
  const compressible: ConversationMessage[] = [];

  for (const m of target) {
    if (config.preserve.protectedTags && m.isProtected) {
      preserved.push(m);
      continue;
    }
    if (config.preserve.checkpoints && m.isCheckpoint) {
      preserved.push(m);
      continue;
    }
    if (config.preserve.userMessages && m.isUserMessage) {
      preserved.push(m);
      continue;
    }
    if (config.preserve.decisionKB && m.isDecision) {
      preserved.push(m);
      continue;
    }
    compressible.push(m);
  }

  const summary: ConversationMessage = {
    role: "system",
    content: createSummary(compressible),
    metadata: { _orqenix_compressed: true, originalCount: compressible.length },
  };

  const before = messages.slice(0, startIdx);
  const after = messages.slice(endIdx);
  const compressed = [...before, ...preserved, summary, ...after];

  const tokensBefore = estimateMessagesTokens(target);
  const tokensAfter = estimateMessagesTokens([...preserved, summary]);

  return {
    compressed,
    removed: compressible.length,
    tokensSaved: Math.max(0, tokensBefore - tokensAfter),
    preservedCount: preserved.length,
  };
}

function createSummary(messages: ConversationMessage[]): string {
  if (messages.length === 0) return "[orqenix:compress-context] empty range";
  const roles = messages.map((m) => m.role).filter((v, i, a) => a.indexOf(v) === i);
  const tasks = messages
    .map((m) => m.taskId)
    .filter((v): v is string => !!v)
    .filter((v, i, a) => a.indexOf(v) === i);

  const decisions = messages.filter((m) => m.isDecision).map((m) => m.content.slice(0, 200));
  const lastFew = messages.slice(-3).map((m) => `${m.role}: ${m.content.slice(0, 150)}`);

  return [
    `[orqenix:compress-context] Summary of ${messages.length} messages`,
    `Roles: ${roles.join(", ")}`,
    tasks.length > 0 ? `Tasks: ${tasks.slice(0, 5).join(", ")}` : "",
    decisions.length > 0 ? `Decisions:\n${decisions.map((d) => `- ${d}`).join("\n")}` : "",
    `Recent excerpts:\n${lastFew.join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function createPlugin(userConfig: Partial<CompressContextConfig> = {}): OrqenixPlugin {
  const config: CompressContextConfig = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    triggers: { ...DEFAULT_CONFIG.triggers, ...userConfig.triggers },
    preserve: { ...DEFAULT_CONFIG.preserve, ...userConfig.preserve },
  };

  return {
    name: "compress-context",
    version: "0.3.0-dev",
    description: "Smart-detect compression of conversation history",
    priority: 80,
    capabilities: ["compression", "context-management"],
    hooks: {
      "session.end": async (_session, ctx) => {
        ctx.log.debug("compress-context: session.end fired", {
          mode: config.mode,
          minTrigger: config.minTokensTrigger,
          maxTrigger: config.maxTokensTrigger,
        });
        // Phase 3: hooks registered. Full integration with conversation store
        // ships when LLM dispatch layer lands (Phase 3.5).
      },
    },
  };
}

export const plugin = createPlugin();
export default plugin;
