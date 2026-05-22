import type { OrqenixPlugin } from "@orqenix/core/plugin";
import { computeCost, priceFor } from "./pricing.js";

interface CostEntry {
  timestamp: number;
  scope: string;
  agent?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

class CostLedger {
  private entries: CostEntry[] = [];

  add(e: CostEntry): void {
    this.entries.push(e);
  }

  list(filter?: { scope?: string; since?: number }): CostEntry[] {
    return this.entries.filter((e) => {
      if (filter?.scope && e.scope !== filter.scope) return false;
      if (filter?.since && e.timestamp < filter.since) return false;
      return true;
    });
  }

  totalUsd(filter?: { scope?: string; since?: number }): number {
    return this.list(filter).reduce((sum, e) => sum + e.costUsd, 0);
  }

  byAgent(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of this.entries) {
      const k = e.agent ?? "unknown";
      out[k] = (out[k] ?? 0) + e.costUsd;
    }
    return out;
  }

  byModel(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of this.entries) {
      out[e.model] = (out[e.model] ?? 0) + e.costUsd;
    }
    return out;
  }

  clear(): void {
    this.entries = [];
  }
}

export const ledger = new CostLedger();

export const plugin: OrqenixPlugin = {
  name: "cost-tracker",
  version: "0.2.0-dev",
  description: "Tracks token usage and cost per LLM call",
  priority: 50,
  capabilities: ["cost-tracking", "transparency"],
  hooks: {
    "llm.call.after": async (call, response, _ctx) => {
      const cost = computeCost(call.model, response.tokens.input, response.tokens.output);
      ledger.add({
        timestamp: Date.now(),
        scope: call.scope.short,
        agent: call.agentName,
        model: call.model,
        inputTokens: response.tokens.input,
        outputTokens: response.tokens.output,
        costUsd: cost,
      });
    },
  },
};

export { computeCost, priceFor };
export default plugin;
