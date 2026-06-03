import { z } from 'zod';
import { OrqenixError } from '@orqenix/core';
import { CONTENT_HASH_PATTERN } from '@orqenix/storage-diff';

export const IndexEntrySchema = z.object({
  relPath: z.string().min(1).max(2048),
  contentHash: z.string().regex(CONTENT_HASH_PATTERN),
  sizeBytes: z.number().int().nonnegative(),
  modifiedAt: z.string(),
  scopeId: z.string().min(1),
}).strict();
export type IndexEntry = z.infer<typeof IndexEntrySchema>;

export interface ReindexStats {
  filesScanned: number;
  filesAdded: number;
  filesUpdated: number;
  filesRemoved: number;
  filesUnchanged: number;
  durationMs: number;
}

export class ReindexError extends OrqenixError {
  constructor(reason: string) { super(`reindex error: ${reason}`, 'REINDEX'); }
}
