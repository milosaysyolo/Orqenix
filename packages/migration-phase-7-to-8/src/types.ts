// SPDX-License-Identifier: Apache-2.0
// @orqenix/migration-phase-7-to-8 , Type definitions

export interface MigrationCheckResult {
  /** Whether the project is in a valid Phase 7 state */
  ready: boolean;
  /** Detected phase (7 if scope.yaml present; 8 if already migrated) */
  detectedPhase: 7 | 8 | 'unknown';
  /** Issues blocking migration */
  blockers: string[];
  /** Non-blocking warnings */
  warnings: string[];
  /** Estimated entries to backfill */
  estimatedEntries: number;
}

export interface MigrationDryRunResult {
  migrationsToApply: number[];
  entriesToBackfill: number;
  branchId: string;
  branchName: string;
  estimatedDiskImpactKb: number;
  noDataLoss: boolean;
}

export interface MigrationApplyResult {
  success: boolean;
  projectId: string;
  branchId: string;
  backupPath: string;
  migrationsApplied: number[];
  entriesBackfilled: number;
  rollbackUntil: string; // ISO timestamp (30 days)
  auditId: string;
}

export interface MigrationRollbackResult {
  success: boolean;
  restoredFrom: string;
  message: string;
}

export class MigrationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'MigrationError';
    Object.setPrototypeOf(this, MigrationError.prototype);
  }
}
