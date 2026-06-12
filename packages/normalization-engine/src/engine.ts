// SPDX-License-Identifier: Apache-2.0
// @orqenix/normalization-engine , Engine core
//
// Orchestrates import (auto-detect adapter → CSF) and export (CSF → target).
// Per CR v8.0 Chapter 8.

import type { CanonicalSkillFormat } from '@orqenix/csf';
import {
  type InputAdapter,
  type OutputAdapter,
  type ImportInput,
  type NormalizationImportResult,
  type NormalizationExportResult,
  NoAdapterMatchError,
  AmbiguousMatchError,
  UnsupportedTargetError,
  NormalizationError,
} from './types';

export interface NormalizationEngineOptions {
  inputAdapters: InputAdapter[];
  outputAdapters: OutputAdapter[];
}

export class NormalizationEngine {
  private readonly inputAdapters: Map<string, InputAdapter>;
  private readonly outputAdapters: Map<string, OutputAdapter>;

  constructor(options: NormalizationEngineOptions) {
    this.inputAdapters = new Map(options.inputAdapters.map((a) => [a.kind, a]));
    this.outputAdapters = new Map(options.outputAdapters.map((a) => [a.kind, a]));
  }

  /**
   * Imports an external plugin → CSF.
   *
   * If sourceKind is specified, uses that adapter directly. Otherwise auto-detects
   * by running each adapter's detect() and selecting the highest confidence.
   * Throws AmbiguousMatchError if multiple adapters tie at high confidence.
   */
  async import(input: ImportInput): Promise<NormalizationImportResult> {
    const adapter = await this.selectAdapter(input);

    let csf: CanonicalSkillFormat;
    try {
      csf = await adapter.parse(input);
    } catch (err) {
      throw new NormalizationError(
        'PARSE_FAILED',
        `Adapter '${adapter.kind}' failed to parse: ${(err as Error).message}`,
        err
      );
    }

    // Collect any warnings from the CSF (e.g., adapter-noted lossy import fields)
    const warnings: string[] = [];
    if (csf.provenance.imported_from?.kind !== adapter.kind) {
      warnings.push(
        `Provenance kind mismatch: expected ${adapter.kind}, got ${csf.provenance.imported_from?.kind}`
      );
    }

    return { csf, adapter, warnings };
  }

  /**
   * Exports CSF → target platform format.
   */
  async export(
    csf: CanonicalSkillFormat,
    targetKind: string
  ): Promise<NormalizationExportResult> {
    const adapter = this.outputAdapters.get(targetKind);
    if (!adapter) {
      throw new UnsupportedTargetError(targetKind);
    }

    const report = adapter.validateExportability(csf);
    const output = await adapter.serialize(csf);

    return { output, adapter, report };
  }

  /** Lists available input adapter kinds */
  listInputAdapters(): string[] {
    return Array.from(this.inputAdapters.keys());
  }

  /** Lists available output adapter kinds */
  listOutputAdapters(): string[] {
    return Array.from(this.outputAdapters.keys());
  }

  // ─── Private ────────────────────────────────────────────────────────

  private async selectAdapter(input: ImportInput): Promise<InputAdapter> {
    // Explicit sourceKind: use directly
    if (input.sourceKind) {
      const adapter = this.inputAdapters.get(input.sourceKind);
      if (!adapter) {
        throw new NormalizationError(
          'UNKNOWN_SOURCE_KIND',
          `No input adapter for sourceKind '${input.sourceKind}'`
        );
      }
      return adapter;
    }

    // Auto-detect: run each adapter's detect()
    const candidates: Array<{ adapter: InputAdapter; confidence: number }> = [];
    for (const adapter of this.inputAdapters.values()) {
      try {
        const detection = await adapter.detect(input);
        if (detection.matched) {
          candidates.push({ adapter, confidence: detection.confidence });
        }
      } catch {
        // detect failures are non-fatal; skip this adapter
      }
    }

    if (candidates.length === 0) {
      throw new NoAdapterMatchError();
    }

    candidates.sort((a, b) => b.confidence - a.confidence);

    // Ambiguity: top two within 0.1 confidence
    if (
      candidates.length >= 2 &&
      candidates[0]!.confidence - candidates[1]!.confidence < 0.1 &&
      candidates[0]!.confidence < 0.95
    ) {
      throw new AmbiguousMatchError(
        candidates.slice(0, 3).map((c) => ({
          kind: c.adapter.kind,
          confidence: c.confidence,
        }))
      );
    }

    return candidates[0]!.adapter;
  }
}
