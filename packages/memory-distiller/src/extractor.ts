import type { ExtractionCandidate } from "./contracts.js";
import type { MemoryType } from "@orqenix/memory-tiers";

interface Pattern {
  type: MemoryType;
  rx: RegExp;
  confidence: number;
}

const PATTERNS: Pattern[] = [
  { type: "preference", rx: /\b(i|we)\s+(prefer|love|enjoy|favor)\b/i, confidence: 0.85 },
  { type: "preference", rx: /\b(i|we)\s+(like|hate|dislike|avoid)\b/i, confidence: 0.7 },
  {
    type: "decision",
    rx: /\b(decided\s+to|chose\s+to|going\s+with|we'?ll\s+use)\b/i,
    confidence: 0.85,
  },
  { type: "decision", rx: /\b(let'?s\s+go\s+with|should\s+use|will\s+adopt)\b/i, confidence: 0.7 },
  { type: "task", rx: /\b(todo:|to-?do:|action\s+item:)/i, confidence: 0.9 },
  { type: "task", rx: /\b(need\s+to|must|have\s+to)\s+\w+/i, confidence: 0.7 },
  { type: "task", rx: /\b(should|might\s+want\s+to)\s+\w+/i, confidence: 0.55 },
  { type: "fact", rx: /\b(i\s+am|my\s+name\s+is|i'?m\s+\w+\s+at)/i, confidence: 0.85 },
  { type: "fact", rx: /\bthe\s+\w+\s+is\s+\w+/i, confidence: 0.55 },
  { type: "learning", rx: /\b(i\s+learned|i\s+realized|aha|now\s+i\s+know)\b/i, confidence: 0.85 },
  { type: "learning", rx: /\b(turns\s+out|interesting\s+that)\b/i, confidence: 0.7 },
  {
    type: "skill",
    rx: /\b(how\s+to|the\s+way\s+to|technique\s+for|trick\s+for)\b/i,
    confidence: 0.7,
  },
  {
    type: "relationship",
    rx: /\b(\w+\s+(reports\s+to|works\s+with|manages|leads))\b/i,
    confidence: 0.7,
  },
  { type: "observation", rx: /\b(noticed|observed|saw\s+that)\b/i, confidence: 0.55 },
];

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8 && s.length <= 2000);
}

export function extractFromText(text: string, sourceEntryId: string): ExtractionCandidate[] {
  const out: ExtractionCandidate[] = [];
  const seen = new Set<string>();
  for (const sentence of splitSentences(text)) {
    for (const p of PATTERNS) {
      if (p.rx.test(sentence)) {
        const key = `${p.type}|${sentence}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          type: p.type,
          content: sentence,
          confidence: p.confidence,
          sourceEntryId,
          matchedPattern: p.rx.source,
        });
      }
    }
  }
  return out;
}

export const _PATTERN_COUNT = PATTERNS.length;
