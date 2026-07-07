import type { MeshTransport } from "@orqenix/mesh-transport-core";

export interface PriorityList {
  readonly order: ReadonlyArray<string>;
}

export const DEFAULT_PRIORITY: PriorityList = { order: ["libp2p", "http"] };

export function priorityList(order: ReadonlyArray<string>): PriorityList {
  if (order.length === 0) throw new Error("priorityList: must contain at least one transport kind");
  const seen = new Set<string>();
  for (const k of order) {
    if (seen.has(k)) throw new Error(`priorityList: duplicate kind ${k}`);
    seen.add(k);
  }
  return { order: [...order] };
}

export function sortByPriority(
  transports: ReadonlyArray<MeshTransport>,
  priority: PriorityList,
): MeshTransport[] {
  const rank = new Map<string, number>();
  priority.order.forEach((k, i) => rank.set(k, i));
  const indexed = transports.map((t, i) => ({ t, i }));
  indexed.sort((a, b) => {
    const ra = rank.has(a.t.kind) ? (rank.get(a.t.kind) as number) : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.t.kind) ? (rank.get(b.t.kind) as number) : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a.i - b.i;
  });
  return indexed.map((x) => x.t);
}
