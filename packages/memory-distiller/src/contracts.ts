// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";
import { OrqenixError } from "@orqenix/core";
import { MEMORY_TYPES, type MemoryType } from "@orqenix/memory-tiers";

export interface ExtractionCandidate {
  type: MemoryType;
  content: string;
  confidence: number;
  sourceEntryId: string;
  matchedPattern?: string;
}

export const DistillerConfigSchema = z
  .object({
    batchSize: z.number().int().min(1).max(1000).default(50),
    cpuLimitPercent: z.number().min(1).max(100).default(20),
    measureWindowMs: z.number().int().min(10).max(60_000).default(500),
    minConfidence: z.number().min(0).max(1).default(0.5),
    enabledTypes: z.array(z.enum(MEMORY_TYPES)).default([...MEMORY_TYPES]),
    maxCandidatesPerEntry: z.number().int().min(1).max(20).default(5),
  })
  .strict();
export type DistillerConfig = z.infer<typeof DistillerConfigSchema>;

export const DEFAULT_DISTILLER_CONFIG: DistillerConfig = DistillerConfigSchema.parse({});

export interface DistillationStats {
  entriesScanned: number;
  candidatesExtracted: number;
  memoriesCreated: number;
  duplicatesSkipped: number;
  durationMs: number;
  cpuPercentObserved: number;
  throttleSleepMs: number;
}

export class DistillerError extends OrqenixError {
  constructor(reason: string) {
    super(`distiller error: ${reason}`, "DISTILLER");
  }
}
