import { z } from "zod";
import { OrqenixError, type Brand } from "@orqenix/core";
import { SCOPE_ID_PATTERN } from "@orqenix/scope-identity";
import { CONTENT_HASH_PATTERN } from "@orqenix/storage-diff";

export type MemoryId = Brand<string, "MemoryId">;
export const MEMORY_ID_PATTERN = /^mem:[A-Z2-7]{32}$/;

export const MEMORY_TIERS = ["working", "episodic", "semantic", "procedural"] as const;
export type MemoryTier = (typeof MEMORY_TIERS)[number];

export const MEMORY_TYPES = [
  "fact",
  "preference",
  "decision",
  "task",
  "learning",
  "relationship",
  "skill",
  "observation",
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MemoryEntrySchema = z
  .object({
    id: z.string().regex(MEMORY_ID_PATTERN),
    tier: z.enum(MEMORY_TIERS),
    type: z.enum(MEMORY_TYPES),
    content: z
      .string()
      .min(1)
      .max(16 * 1024),
    contentHash: z.string().regex(CONTENT_HASH_PATTERN),
    sourceEntryIds: z.array(z.string().min(1)).min(1).max(64),
    confidence: z.number().min(0).max(1),
    createdAt: z.string().datetime({ offset: true }),
    lastAccessedAt: z.string().datetime({ offset: true }),
    accessCount: z.number().int().nonnegative(),
    scopeId: z.string().regex(SCOPE_ID_PATTERN),
    metadata: z.record(z.unknown()).default({}),
  })
  .strict();
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

export const TierPromotionPolicySchema = z
  .object({
    workingToEpisodic: z.object({
      minAccessCount: z.number().int().min(1).default(2),
      minAgeMs: z.number().int().nonnegative().default(60_000),
    }),
    episodicToSemantic: z.object({
      minAccessCount: z.number().int().min(1).default(5),
      minAgeMs: z
        .number()
        .int()
        .nonnegative()
        .default(7 * 24 * 3600 * 1000),
      minConfidence: z.number().min(0).max(1).default(0.75),
    }),
    semanticToProcedural: z.object({
      minAccessCount: z.number().int().min(1).default(10),
      minAgeMs: z
        .number()
        .int()
        .nonnegative()
        .default(30 * 24 * 3600 * 1000),
      requiredTypes: z.array(z.enum(MEMORY_TYPES)).default(["skill", "task"]),
    }),
  })
  .strict();
export type TierPromotionPolicy = z.infer<typeof TierPromotionPolicySchema>;

export const DEFAULT_POLICY: TierPromotionPolicy = TierPromotionPolicySchema.parse({
  workingToEpisodic: {},
  episodicToSemantic: {},
  semanticToProcedural: {},
});

export class InvalidTierError extends OrqenixError {
  constructor(value: unknown) {
    super(`invalid memory tier: ${String(value)}`, "INVALID_TIER");
  }
}
export class InvalidMemoryTypeError extends OrqenixError {
  constructor(value: unknown) {
    super(`invalid memory type: ${String(value)}`, "INVALID_MEMORY_TYPE");
  }
}
export class MemoryNotFoundError extends OrqenixError {
  constructor(id: string) {
    super(`memory not found: ${id}`, "MEMORY_NOT_FOUND");
  }
}
export class ImmutableMemoryError extends OrqenixError {
  constructor(id: string) {
    super(`memory is immutable (procedural tier): ${id}`, "IMMUTABLE_MEMORY");
  }
}
