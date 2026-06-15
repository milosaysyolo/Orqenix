// SPDX-License-Identifier: Apache-2.0
// Reference compression-strategy plugin: semantic summarization.
//
// IMPORTANT (INV-13): MUST honor protection_flags.never_compress. Entries with
// that flag (subagent returns, pinned) are passed through unchanged.

interface MemoryEntryLite {
  id: string;
  content: string;
  protection_flags?: { never_compress?: boolean } | null;
}

interface CompressInput {
  entries: MemoryEntryLite[];
}

interface CompressOutput {
  compressed: Array<{ id: string; content: string; compressed: boolean }>;
}

export async function invoke(input: CompressInput): Promise<CompressOutput> {
  const compressed = input.entries.map((entry) => {
    // INV-13: never compress protected entries
    if (entry.protection_flags?.never_compress) {
      return { id: entry.id, content: entry.content, compressed: false };
    }
    // Semantic compression: keep first sentence + summary marker
    const firstSentence = entry.content.split(/[.!?]/)[0] ?? entry.content;
    const summary =
      entry.content.length > 200
        ? `${firstSentence.slice(0, 180)}... [compressed from ${entry.content.length} chars]`
        : entry.content;
    return { id: entry.id, content: summary, compressed: entry.content.length > 200 };
  });
  return { compressed };
}
