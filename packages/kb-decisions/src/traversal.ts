import type { DecisionGraph, DecisionNode } from "./types.js";

export interface TraversalOptions {
  maxDepth?: number;
}

export function ancestors(
  graph: DecisionGraph,
  fromId: string,
  opts: TraversalOptions = {}
): DecisionNode[] {
  const max = opts.maxDepth ?? Infinity;
  const out: DecisionNode[] = [];
  const seen = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [
    { id: fromId, depth: 0 },
  ];
  while (queue.length) {
    const { id, depth } = queue.shift()!;
    if (seen.has(id) || depth > max) continue;
    seen.add(id);
    const node = graph.nodes.get(id);
    if (!node) continue;
    out.push(node);
    for (const p of node.parents) {
      queue.push({ id: p, depth: depth + 1 });
    }
  }
  return out;
}

export function descendants(
  graph: DecisionGraph,
  fromId: string,
  opts: TraversalOptions = {}
): DecisionNode[] {
  const max = opts.maxDepth ?? Infinity;
  const childrenOf = new Map<string, string[]>();
  for (const [, n] of graph.nodes) {
    for (const p of n.parents) {
      const arr = childrenOf.get(p) ?? [];
      arr.push(n.id);
      childrenOf.set(p, arr);
    }
  }
  const out: DecisionNode[] = [];
  const seen = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [
    { id: fromId, depth: 0 },
  ];
  while (queue.length) {
    const { id, depth } = queue.shift()!;
    if (seen.has(id) || depth > max) continue;
    seen.add(id);
    const node = graph.nodes.get(id);
    if (!node) continue;
    out.push(node);
    for (const c of childrenOf.get(id) ?? []) {
      queue.push({ id: c, depth: depth + 1 });
    }
  }
  return out;
}

export function pathBetween(
  graph: DecisionGraph,
  fromId: string,
  toId: string
): DecisionNode[] | null {
  const prev = new Map<string, string | null>();
  const queue: string[] = [fromId];
  prev.set(fromId, null);
  while (queue.length) {
    const id = queue.shift()!;
    if (id === toId) {
      const path: string[] = [];
      let cur: string | null = id;
      while (cur !== null) {
        path.unshift(cur);
        cur = prev.get(cur) ?? null;
      }
      return path
        .map((p) => graph.nodes.get(p))
        .filter((n): n is DecisionNode => !!n);
    }
    const node = graph.nodes.get(id);
    if (!node) continue;
    for (const p of node.parents) {
      if (!prev.has(p)) {
        prev.set(p, id);
        queue.push(p);
      }
    }
  }
  return null;
}
