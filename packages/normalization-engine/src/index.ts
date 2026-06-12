// SPDX-License-Identifier: Apache-2.0
// @orqenix/normalization-engine , Public API surface
//
// Phase 8 (D8.β) , Charter gate G66

export { NormalizationEngine } from './engine';
export type { NormalizationEngineOptions } from './engine';

export { buildCsf, computeContentHash, getOriginalFormat } from './csf-builder';
export type { CsfBuilderInput } from './csf-builder';

export {
  roundTrip,
  assertRoundTrip,
  normalizeWhitespace,
} from './round-trip';
export type { RoundTripResult } from './round-trip';

export type {
  ImportInput,
  DetectionResult,
  InputAdapter,
  OutputAdapter,
  SerializedFormat,
  ExportabilityReport,
  NormalizationImportResult,
  NormalizationExportResult,
} from './types';

export {
  NormalizationError,
  NoAdapterMatchError,
  AmbiguousMatchError,
  UnsupportedTargetError,
} from './types';
