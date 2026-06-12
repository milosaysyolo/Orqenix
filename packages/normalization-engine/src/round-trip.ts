// SPDX-License-Identifier: Apache-2.0
// @orqenix/normalization-engine , Round-trip fidelity helpers
//
// Per INV-15 + ADR-E-015: import → CSF → export must be byte-identical to the
// original (modulo whitespace normalization).

import type { InputAdapter, OutputAdapter, ImportInput } from './types';

/**
 * Whitespace normalization rules applied before round-trip comparison.
 * These rules are documented + stable so fidelity is deterministic.
 */
export function normalizeWhitespace(content: string): string {
  return content
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Trim trailing whitespace per line
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    // Collapse 3+ blank lines to 1
    .replace(/\n{3,}/g, '\n\n')
    // Trim leading/trailing whitespace of whole document
    .trim();
}

export interface RoundTripResult {
  /** Whether round-trip is byte-identical (after whitespace normalization) */
  identical: boolean;
  /** Original content (normalized) */
  originalNormalized: string;
  /** Round-tripped content (normalized) */
  roundTrippedNormalized: string;
  /** Character-level diff position if not identical (null if identical) */
  firstDiffIndex: number | null;
}

/**
 * Performs a round-trip: import original → CSF → export → compare.
 *
 * @param original The original source content
 * @param input The input adapter
 * @param output The matching output adapter
 */
export async function roundTrip(
  original: string,
  input: InputAdapter,
  output: OutputAdapter,
  importInput?: Partial<ImportInput>
): Promise<RoundTripResult> {
  // Import
  const csf = await input.parse({
    content: original,
    ...importInput,
  });

  // Export
  const serialized = await output.serialize(csf);

  // Compare (normalized)
  const originalNormalized = normalizeWhitespace(original);
  const roundTrippedNormalized = normalizeWhitespace(serialized.content);

  const identical = originalNormalized === roundTrippedNormalized;
  let firstDiffIndex: number | null = null;
  if (!identical) {
    const minLen = Math.min(originalNormalized.length, roundTrippedNormalized.length);
    for (let i = 0; i < minLen; i++) {
      if (originalNormalized[i] !== roundTrippedNormalized[i]) {
        firstDiffIndex = i;
        break;
      }
    }
    if (firstDiffIndex === null) {
      firstDiffIndex = minLen; // length mismatch
    }
  }

  return {
    identical,
    originalNormalized,
    roundTrippedNormalized,
    firstDiffIndex,
  };
}

/**
 * Asserts round-trip fidelity (throws if not identical). Used in conformance
 * tests for each adapter pair.
 */
export async function assertRoundTrip(
  original: string,
  input: InputAdapter,
  output: OutputAdapter,
  importInput?: Partial<ImportInput>
): Promise<void> {
  const result = await roundTrip(original, input, output, importInput);
  if (!result.identical) {
    const context =
      result.firstDiffIndex !== null
        ? ` First diff at index ${result.firstDiffIndex}: ` +
          `expected "${result.originalNormalized.slice(result.firstDiffIndex, result.firstDiffIndex + 30)}" ` +
          `got "${result.roundTrippedNormalized.slice(result.firstDiffIndex, result.firstDiffIndex + 30)}"`
        : '';
    throw new Error(
      `Round-trip fidelity failed for ${input.kind} <-> ${output.kind}.${context}`
    );
  }
}
