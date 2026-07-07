// SPDX-License-Identifier: Apache-2.0
// @orqenix/verification-loop , Thresholds config (settings registry integration)
import { DEFAULT_VERIFICATION_THRESHOLDS, type VerificationThresholds } from "./types";
export function loadThresholds(
  overrides?: Partial<VerificationThresholds>,
): VerificationThresholds {
  return { ...DEFAULT_VERIFICATION_THRESHOLDS, ...overrides };
}
