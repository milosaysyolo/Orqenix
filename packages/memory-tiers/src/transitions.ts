import type { MemoryEntry, MemoryTier, TierPromotionPolicy } from './contracts.js';

export function evaluatePromotion(
  entry: MemoryEntry,
  now: number,
  policy: TierPromotionPolicy,
): MemoryTier | null {
  const ageMs = now - new Date(entry.createdAt).getTime();

  if (entry.tier === 'working') {
    const p = policy.workingToEpisodic;
    if (entry.accessCount >= p.minAccessCount && ageMs >= p.minAgeMs) return 'episodic';
    return null;
  }
  if (entry.tier === 'episodic') {
    const p = policy.episodicToSemantic;
    if (
      entry.accessCount >= p.minAccessCount &&
      ageMs >= p.minAgeMs &&
      entry.confidence >= p.minConfidence
    ) return 'semantic';
    return null;
  }
  if (entry.tier === 'semantic') {
    const p = policy.semanticToProcedural;
    if (
      entry.accessCount >= p.minAccessCount &&
      ageMs >= p.minAgeMs &&
      p.requiredTypes.includes(entry.type)
    ) return 'procedural';
    return null;
  }
  return null;
}

export function canDemote(tier: MemoryTier): boolean {
  return tier === 'working' || tier === 'episodic';
}

export function nextTier(current: MemoryTier): MemoryTier | null {
  const order: MemoryTier[] = ['working', 'episodic', 'semantic', 'procedural'];
  const i = order.indexOf(current);
  return i >= 0 && i < order.length - 1 ? order[i + 1]! : null;
}
