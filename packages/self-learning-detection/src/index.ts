// SPDX-License-Identifier: Apache-2.0
// @orqenix/self-learning-detection , Public API surface

export { BasicDetector } from "./detector";
export type { BasicDetectorOptions } from "./detector";

export { SequenceDetector } from "./sequence-detector";
export { FrequencyAnalyzer } from "./frequency-analyzer";
export { CandidateStore } from "./candidate-store";

export type {
  DetectionThresholds,
  ActionSequence,
  DetectedPattern,
  InstinctCandidate,
  DetectionInput,
  DetectionResult,
  IDetector,
} from "./types";

export { DEFAULT_THRESHOLDS, InstinctCandidateSchema } from "./types";
