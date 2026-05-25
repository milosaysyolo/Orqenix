import type { LLMCall, OrqenixPlugin } from "@orqenix/core/plugin";

export type CompressInputMode = "soft" | "rewrite" | "aggressive";

export interface CompressInputConfig {
  enabled: boolean;
  mode: CompressInputMode;
  removeWhitespaceNoise: boolean;
  deduplicate: boolean;
  rewriteToPseudoCode: boolean;
  instructConcision: boolean;
  maxRewriteTokens: number;
  preserveCodeBlocks: boolean;
  preserveQuotes: boolean;
}

const DEFAULT_CONFIG: CompressInputConfig = {
  enabled: true,
  mode: "soft",
  removeWhitespaceNoise: true,
  deduplicate: true,
  rewriteToPseudoCode: false,
  instructConcision: true,
  maxRewriteTokens: 200,
  preserveCodeBlocks: true,
  preserveQuotes: true,
};

const CONCISION_INSTRUCTIONS = `
OUTPUT GUIDELINES (orqenix):
- Skip preambles like "Let me think about this..." or "I'll start by..."
- Skip step-by-step thinking narration unless explicitly requested
- Go directly to the answer or action
- Use code/diff blocks for code, not prose explanations
- Keep explanations short (1-2 sentences) unless complexity demands more
- Don't restate the question before answering
- Don't repeat yourself
`.trim();

export function removeWhitespaceNoise(text: string, preserveCodeBlocks: boolean): string {
  if (!preserveCodeBlocks) {
    return text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n");
  }
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n");
    })
    .join("");
}

export function deduplicateMessages(
  messages: Array<{ role: string; content: string }>,
): Array<{ role: string; content: string }> {
  const out: Array<{ role: string; content: string }> = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    if (last && last.role === m.role && last.content.trim() === m.content.trim()) continue;
    out.push(m);
  }
  return out;
}

export function injectConcision(
  messages: Array<{ role: string; content: string }>,
): Array<{ role: string; content: string }> {
  const sysIdx = messages.findIndex((m) => m.role === "system");
  if (sysIdx === -1) {
    return [{ role: "system", content: CONCISION_INSTRUCTIONS }, ...messages];
  }
  if (messages[sysIdx]!.content.includes("OUTPUT GUIDELINES (orqenix)")) {
    return messages;
  }
  const updated = [...messages];
  updated[sysIdx] = {
    role: "system",
    content: `${updated[sysIdx]!.content}\n\n${CONCISION_INSTRUCTIONS}`,
  };
  return updated;
}

export function createPlugin(userConfig: Partial<CompressInputConfig> = {}): OrqenixPlugin {
  const config: CompressInputConfig = { ...DEFAULT_CONFIG, ...userConfig };

  return {
    name: "compress-input",
    version: "0.3.0-dev",
    description: "Soft compression of LLM input + concision instructions",
    priority: 70,
    capabilities: ["compression", "input-optimization"],
    hooks: {
      "llm.call.before": async (call: LLMCall, _ctx) => {
        if (!config.enabled) return call;
        let messages = call.messages;

        if (config.removeWhitespaceNoise) {
          messages = messages.map((m) => ({
            ...m,
            content: removeWhitespaceNoise(m.content, config.preserveCodeBlocks),
          }));
        }
        if (config.deduplicate) {
          messages = deduplicateMessages(messages);
        }
        if (config.instructConcision) {
          messages = injectConcision(messages);
        }

        return { ...call, messages };
      },
    },
  };
}

export const plugin = createPlugin();
export default plugin;
