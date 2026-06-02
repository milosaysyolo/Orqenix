// SPDX-License-Identifier: Apache-2.0
// @bc CS-026 Migration Contracts
// @gate G24

import { z } from 'zod';
import { OrqenixError } from '@orqenix/core';

export const MIGRATION_PHASES = ['phase-4', 'phase-5'] as const;
export type MigrationPhase = (typeof MIGRATION_PHASES)[number];

export const MigrationStepSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  fromPhase: z.enum(MIGRATION_PHASES),
  toPhase: z.enum(MIGRATION_PHASES),
}).strict();
export type MigrationStep = z.infer<typeof MigrationStepSchema>;

export interface MigrationReport {
  fromPhase: MigrationPhase;
  toPhase: MigrationPhase;
  stepsApplied: MigrationStep[];
  backupPath: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface RollbackReport {
  toPhase: MigrationPhase;
  backupPath: string;
  restoredAt: string;
}

export class MigrationError extends OrqenixError {
  constructor(reason: string) { super(`migration error: ${reason}`, 'MIGRATION'); }
}
export class RollbackError extends OrqenixError {
  constructor(reason: string) { super(`rollback error: ${reason}`, 'ROLLBACK'); }
}
export class BackupMissingError extends OrqenixError {
  constructor(path: string) { super(`backup not found at ${path}`, 'BACKUP_MISSING'); }
}
