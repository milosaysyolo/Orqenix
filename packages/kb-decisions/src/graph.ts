import { createHash } from "node:crypto";
import type { DecisionGraph, DecisionNode } from "./types.js";

export function createGraph(): DecisionGraph {
  return { nodes: new Map() };
}

export function deriveId(input: {
  title: string;
  rationale: string;
  decidedAt: number;
}): string {
  const h = createHash("sha256");
  h.update(`${input.title}\n${input.rationale}\n${input.decidedAt}`);
  return h.digest("hex").slice(0, 16);
}

export function addDecision(
  graph: DecisionGraph,
  node: DecisionNode
): void {
  if (graph.nodes.has(node.id)) {
    throw new Error(`Decision ${node.id} already exists`);
  }
  for (const p of node.parents) {
    if (!graph.nodes.has(p)) {
      throw new Error(`Parent ${p} not in graph`);
    }
  }
  graph.nodes.set(node.id, node);
}

export function getDecision(
  graph: DecisionGraph,
  id: string
): DecisionNode | undefined {
  return graph.nodes.get(id);
}

export function removeDecision(graph: DecisionGraph, id: string): boolean {
  if (!graph.nodes.has(id)) return false;
  for (const [, n] of graph.nodes) {
    if (n.parents.includes(id)) {
      throw new Error(`Cannot remove ${id}, it has children`);
    }
  }
  graph.nodes.delete(id);
  return true;
}

export function listByTag(graph: DecisionGraph, tag: string): DecisionNode[] {
  const out: DecisionNode[] = [];
  for (const [, n] of graph.nodes) {
    if (n.tags?.includes(tag)) out.push(n);
  }
  return out;
}
