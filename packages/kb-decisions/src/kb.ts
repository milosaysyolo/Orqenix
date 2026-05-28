import type { DecisionGraph, DecisionNode } from "./types.js";
import { deriveId } from "./graph.js";

export interface DecisionEntry {
  id: string;
  title: string;
  body: string;
  type: string;
  scopeId: string;
  enforcement: string;
  tags: string[];
  timestamp: number;
  confidence?: number;
}

export class DecisionKB {
  private constructor(private graph: DecisionGraph) {}

  static async open(): Promise<DecisionKB> {
    return new DecisionKB({ nodes: new Map() });
  }

  async append(
    entry: Omit<DecisionEntry, "id" | "timestamp">,
  ): Promise<string> {
    const now = Date.now();
    const id = deriveId({
      title: entry.title,
      rationale: entry.body,
      decidedAt: now,
    });
    const node: DecisionNode = {
      id,
      title: entry.title,
      decidedAt: now,
      rationale: entry.body,
      parents: [],
      tags: entry.tags,
    };
    this.graph.nodes.set(id, node);
    return id;
  }

  async getById(id: string): Promise<DecisionEntry | null> {
    const n = this.graph.nodes.get(id);
    if (!n) return null;
    return this.toEntry(n);
  }

  async listByType(
    type: string,
    _scope: string,
    _limit?: number,
  ): Promise<DecisionEntry[]> {
    const out: DecisionEntry[] = [];
    for (const [, n] of this.graph.nodes) {
      if (n.tags?.includes(type)) out.push(this.toEntry(n));
    }
    return out;
  }

  async semanticSearch(
    queryOrTopK?: string | number,
    topK?: number,
  ): Promise<DecisionEntry[]> {
    const k = typeof queryOrTopK === "number" ? queryOrTopK : (topK ?? 10);
    const all = Array.from(this.graph.nodes.values());
    const scored = all.map((n) => this.toEntry(n, 0.5));
    return scored.slice(0, k);
  }

  private toEntry(n: DecisionNode, confidence = 0.5): DecisionEntry {
    return {
      id: n.id,
      title: n.title,
      body: n.rationale,
      type: n.tags?.[0] ?? "general",
      scopeId: "default",
      enforcement: "advisory",
      tags: n.tags ?? [],
      timestamp: n.decidedAt,
      confidence,
    };
  }
}
