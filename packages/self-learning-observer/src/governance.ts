// SPDX-License-Identifier: Apache-2.0
// @orqenix/self-learning-observer , Self-learning loop governance
//
// Cycle breaker / governor for the observer→detection→promoter→genesis loop.
// Prevents unbounded skill generation by capping iterations, detecting
// convergence, and enforcing backpressure.

/**
 * Governance configuration for the self-learning loop.
 *
 * The loop runs up to `maxIterationsPerSession` times. If the last
 * `convergenceWindow` detection runs produce identical pattern sets, the loop
 * terminates early (converged). Between iterations at least `cooldownMs` must
 * elapse. No more than `generationCap` skills are created per cycle.
 */
export interface SelfLearningGovernance {
  /** Maximum loop iterations per session (default: 5) */
  maxIterationsPerSession: number;
  /** Number of consecutive identical results to declare convergence */
  convergenceWindow: number;
  /** Minimum time between iterations (ms) */
  cooldownMs: number;
  /** Maximum skills generated per cycle (per detection run) */
  generationCap: number;
}

export const DEFAULT_GOVERNANCE: SelfLearningGovernance = {
  maxIterationsPerSession: 5,
  convergenceWindow: 3,
  cooldownMs: 60_000,
  generationCap: 3,
};
