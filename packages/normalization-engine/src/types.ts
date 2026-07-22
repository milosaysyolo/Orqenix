// SPDX-License-Identifier: Apache-2.0
// @orqenix/normalization-engine , Adapter contract types

import type { CanonicalSkillFormat } from '@orqenix/plugin-core';

// ─────────────────────────────────────────────────────────────────────────
// Import input
// ─────────────────────────────────────────────────────────────────────────

export interface ImportInput {
  /** Optional explicit source kind (skips auto-detect) */
  sourceKind?: string;
  /** Source URL (npm/github/direct) */
  url?: string;
  /** Local file path */
  path?: string;
  /** Inline content (paste) */
  content?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Detection result
// ─────────────────────────────────────────────────────────────────────────

export interface DetectionResult {
  matched: boolean;
  /** 0-1 confidence */
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Input adapter contract
// ─────────────────────────────────────────────────────────────────────────

export interface InputAdapter {
  /** Stable identifier (e.g., 'claude-code') */
  readonly kind: string;
  /** Adapter version (recorded in provenance) */
  readonly version: string;
  /** Display name */
  readonly name: string;

  /** Detect whether this adapter can parse the input */
  detect(input: ImportInput): Promise<DetectionResult>;

  /** Parse the input into CSF */
  parse(input: ImportInput): Promise<CanonicalSkillFormat>;
}

// ─────────────────────────────────────────────────────────────────────────
// Output adapter contract
// ─────────────────────────────────────────────────────────────────────────

export interface SerializedFormat {
  /** The serialized content */
  content: string;
  /** Suggested file path/name */
  suggestedPath?: string;
  /** Content MIME type / format */
  format: 'json' | 'yaml' | 'markdown' | 'text';
}

export interface ExportabilityReport {
  /** Fields that cannot be represented in the target format */
  lossyFields: string[];
  /** Warnings about partial representation */
  warnings: string[];
}

export interface OutputAdapter {
  /** Stable identifier */
  readonly kind: string;
  /** Adapter version */
  readonly version: string;
  /** Display name */
  readonly name: string;

  /** Serialize CSF to the target format */
  serialize(csf: CanonicalSkillFormat): Promise<SerializedFormat>;

  /** Check if CSF can be exported without information loss */
  validateExportability(csf: CanonicalSkillFormat): ExportabilityReport;
}

// ─────────────────────────────────────────────────────────────────────────
// Engine results
// ─────────────────────────────────────────────────────────────────────────

export interface NormalizationImportResult {
  csf: CanonicalSkillFormat;
  adapter: InputAdapter;
  warnings: string[];
}

export interface NormalizationExportResult {
  output: SerializedFormat;
  adapter: OutputAdapter;
  report: ExportabilityReport;
}

// ─────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────

export class NormalizationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public override readonly cause?: unknown
  ) {
    super(message);
    this.name = 'NormalizationError';
    Object.setPrototypeOf(this, NormalizationError.prototype);
  }
}

export class NoAdapterMatchError extends NormalizationError {
  constructor() {
    super('NO_ADAPTER_MATCH', 'No input adapter could parse this input');
    Object.setPrototypeOf(this, NoAdapterMatchError.prototype);
  }
}

export class AmbiguousMatchError extends NormalizationError {
  constructor(public readonly candidates: Array<{ kind: string; confidence: number }>) {
    super(
      'AMBIGUOUS_MATCH',
      `Multiple adapters matched: ${candidates.map((c) => c.kind).join(', ')}. Specify sourceKind.`
    );
    Object.setPrototypeOf(this, AmbiguousMatchError.prototype);
  }
}

export class UnsupportedTargetError extends NormalizationError {
  constructor(kind: string) {
    super('UNSUPPORTED_TARGET', `Output adapter not found for: ${kind}`);
    Object.setPrototypeOf(this, UnsupportedTargetError.prototype);
  }
}
