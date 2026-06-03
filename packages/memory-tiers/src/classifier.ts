import type { MemoryTier, MemoryType } from './contracts.js';

export function classifyInitialTier(type: MemoryType, confidence: number): MemoryTier {
  if (confidence < 0.5 || type === 'observation') return 'working';
  if (type === 'learning' || type === 'skill') {
    return confidence >= 0.75 ? 'semantic' : 'episodic';
  }
  if (type === 'fact' || type === 'preference' || type === 'decision' || type === 'relationship') {
    return 'episodic';
  }
  return 'working';
}

const TYPE_PATTERNS: Array<{ type: MemoryType; rx: RegExp }> = [
  { type: 'preference', rx: /\b(i\s+(prefer|like|love|enjoy|hate|dislike|avoid))\b/i },
  { type: 'decision',   rx: /\b(decided\s+to|going\s+with|will\s+use|chose\s+to|let's\s+go\s+with)\b/i },
  { type: 'task',       rx: /\b(todo|to-?do|need\s+to|should|must|will\s+do|action\s+item)\b/i },
  { type: 'fact',       rx: /\b(i\s+am|my\s+name\s+is|i'm|i\s+live|i\s+work)\b/i },
  { type: 'learning',   rx: /\b(learned|realized|understood|now\s+i\s+know|aha)\b/i },
  { type: 'skill',      rx: /\b(how\s+to|the\s+way\s+to|technique\s+for|trick\s+for)\b/i },
  { type: 'relationship', rx: /\b(works\s+with|reports\s+to|partner|colleague|teammate)\b/i },
];

export function inferTypeFromContent(content: string): MemoryType {
  for (const { type, rx } of TYPE_PATTERNS) {
    if (rx.test(content)) return type;
  }
  return 'observation';
}
