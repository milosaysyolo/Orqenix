import { z } from "zod";

/**
 * Zod schema mirroring OrqenixConfig.
 * Loose by design; unknown fields are stripped to avoid blocking forward-compat.
 */
export const OrqenixConfigSchema = z
  .object({
    version: z.string(),
    providers: z.record(z.string(), z.record(z.string(), z.any())),
    routing: z.object({
      default: z.string(),
      fallback: z.string(),
      perAgent: z.record(z.string(), z.string()),
      rules: z.array(z.object({ when: z.string(), model: z.string() })),
    }),
    embedding: z.object({
      primary: z.string(),
      fallback: z.string(),
      localFirst: z.boolean(),
      cacheLocal: z.boolean(),
    }),
    storage: z.object({
      type: z.enum(["sqlite", "postgres"]),
      path: z.string().optional(),
      url: z.string().optional(),
      wal: z.boolean().optional(),
      vacuumInterval: z.string().optional(),
    }),
    memory: z.any(),
    knowledge: z.any(),
    context: z.any(),
    scope: z.any(),
    sync: z.any(),
    webui: z.any(),
    update: z.any(),
    telemetry: z.any(),
  })
  .passthrough();

export type ParsedConfig = z.infer<typeof OrqenixConfigSchema>;
