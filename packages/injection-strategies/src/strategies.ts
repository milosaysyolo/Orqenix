// SPDX-License-Identifier: Apache-2.0
// @bc CS-010 5 Injection Strategies
// @gate G9.1, G9.2, G9.3, G9.4, G9.5

import type { ChatMessage } from "@orqenix/llm-adapter-ollama";
import type { MemoryEntry, MemoryId } from "@orqenix/memory-tiers";
import {
  estimateTokens,
  type InjectionInput,
  type InjectionOutput,
  type InjectionStrategy,
} from "./contracts.js";

function formatMemoryBlock(entries: MemoryEntry[], title: string): string {
  if (entries.length === 0) return "";
  const lines = entries.map((e) => `- [${e.tier}/${e.type}] ${e.content}`);
  return `${title}\n${lines.join("\n")}`;
}

function pickWithinBudget(memories: MemoryEntry[], budget: number, k: number): MemoryEntry[] {
  const picked: MemoryEntry[] = [];
  let used = 0;
  for (const m of memories) {
    if (picked.length >= k) break;
    const cost = estimateTokens(m.content) + 8;
    if (used + cost > budget) break;
    picked.push(m);
    used += cost;
  }
  return picked;
}

// Strategy A: System Prologue — prepend all memories to a single system message
export class StrategyA implements InjectionStrategy {
  readonly name = "A" as const;
  apply(input: InjectionInput): InjectionOutput {
    const budget = input.tokenBudget ?? 2048;
    const k = input.k ?? 5;
    const picked = pickWithinBudget(input.memories, budget, k);
    const block = formatMemoryBlock(picked, "## Relevant memories");
    const existingSystem = input.messages.find((m) => m.role === "system");
    const rest = input.messages.filter((m) => m.role !== "system");
    const sysContent = [existingSystem?.content ?? "", block].filter(Boolean).join("\n\n");
    const messages: ChatMessage[] = sysContent
      ? [{ role: "system", content: sysContent }, ...rest]
      : rest;
    return {
      messages,
      injectedMemoryIds: picked.map((m) => m.id as MemoryId),
      tokensUsed: estimateTokens(block),
      strategy: this.name,
    };
  }
}

// Strategy B: System Prologue Tiered (DEFAULT) — only working+episodic in system
export class StrategyB implements InjectionStrategy {
  readonly name = "B" as const;
  apply(input: InjectionInput): InjectionOutput {
    const budget = input.tokenBudget ?? 2048;
    const k = input.k ?? 5;
    const eager = input.memories.filter((m) => m.tier === "working" || m.tier === "episodic");
    const picked = pickWithinBudget(eager, budget, k);
    const block = formatMemoryBlock(picked, "## Active memories (working + episodic)");
    const existingSystem = input.messages.find((m) => m.role === "system");
    const rest = input.messages.filter((m) => m.role !== "system");
    const sysContent = [existingSystem?.content ?? "", block].filter(Boolean).join("\n\n");
    const messages: ChatMessage[] = sysContent
      ? [{ role: "system", content: sysContent }, ...rest]
      : rest;
    return {
      messages,
      injectedMemoryIds: picked.map((m) => m.id as MemoryId),
      tokensUsed: estimateTokens(block),
      strategy: this.name,
    };
  }
}

// Strategy C: User Annotation — inline before last user message
export class StrategyC implements InjectionStrategy {
  readonly name = "C" as const;
  apply(input: InjectionInput): InjectionOutput {
    const budget = input.tokenBudget ?? 2048;
    const k = input.k ?? 5;
    const picked = pickWithinBudget(input.memories, budget, k);
    const block = formatMemoryBlock(picked, "## Context");
    const out: ChatMessage[] = [...input.messages];
    let lastUserIdx = -1;
    for (let i = out.length - 1; i >= 0; i--) {
      if (out[i]!.role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx >= 0 && block) {
      const orig = out[lastUserIdx]!;
      out[lastUserIdx] = { role: "user", content: `${block}\n\n---\n\n${orig.content}` };
    }
    return {
      messages: out,
      injectedMemoryIds: picked.map((m) => m.id as MemoryId),
      tokensUsed: estimateTokens(block),
      strategy: this.name,
    };
  }
}

// Strategy D: Assistant Recall Turn — inject fake assistant turn before last user
export class StrategyD implements InjectionStrategy {
  readonly name = "D" as const;
  apply(input: InjectionInput): InjectionOutput {
    const budget = input.tokenBudget ?? 2048;
    const k = input.k ?? 5;
    const picked = pickWithinBudget(input.memories, budget, k);
    const block = formatMemoryBlock(picked, "I recall the following relevant context:");
    const out: ChatMessage[] = [];
    let lastUserIdx = -1;
    for (let i = input.messages.length - 1; i >= 0; i--) {
      if (input.messages[i]!.role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    for (let i = 0; i < input.messages.length; i++) {
      if (i === lastUserIdx && block) {
        out.push({ role: "assistant", content: block });
      }
      out.push(input.messages[i]!);
    }
    return {
      messages: out,
      injectedMemoryIds: picked.map((m) => m.id as MemoryId),
      tokensUsed: estimateTokens(block),
      strategy: this.name,
    };
  }
}

// Strategy E: Sidecar Vector — only top-k by confidence into system
export class StrategyE implements InjectionStrategy {
  readonly name = "E" as const;
  apply(input: InjectionInput): InjectionOutput {
    const budget = input.tokenBudget ?? 2048;
    const k = input.k ?? 5;
    const ranked = [...input.memories].sort((a, b) => b.confidence - a.confidence);
    const picked = pickWithinBudget(ranked, budget, k);
    const block = formatMemoryBlock(picked, "## Top-k relevant memories");
    const existingSystem = input.messages.find((m) => m.role === "system");
    const rest = input.messages.filter((m) => m.role !== "system");
    const sysContent = [existingSystem?.content ?? "", block].filter(Boolean).join("\n\n");
    const messages: ChatMessage[] = sysContent
      ? [{ role: "system", content: sysContent }, ...rest]
      : rest;
    return {
      messages,
      injectedMemoryIds: picked.map((m) => m.id as MemoryId),
      tokensUsed: estimateTokens(block),
      strategy: this.name,
    };
  }
}

export const STRATEGIES: Record<"A" | "B" | "C" | "D" | "E", InjectionStrategy> = {
  A: new StrategyA(),
  B: new StrategyB(),
  C: new StrategyC(),
  D: new StrategyD(),
  E: new StrategyE(),
};

export function getStrategy(name: "A" | "B" | "C" | "D" | "E"): InjectionStrategy {
  return STRATEGIES[name];
}

export const DEFAULT_STRATEGY: InjectionStrategy = STRATEGIES.B;
