import { z } from 'zod';
import { OrqenixError } from '@orqenix/core';

export const FILE_EVENTS = ['add', 'change', 'unlink'] as const;
export type FileEventKind = (typeof FILE_EVENTS)[number];

export interface FileEvent {
  readonly kind: FileEventKind;
  readonly path: string;
  readonly relPath: string;
  readonly timestamp: string;
}

export const WatcherConfigSchema = z.object({
  rootDir: z.string().min(1),
  patterns: z.array(z.string()).default(['**/*']),
  ignore: z.array(z.string()).default([
    '**/.git/**', '**/node_modules/**', '**/dist/**',
    '**/.orqenix/identity.key', '**/.orqenix/gate-reports/**',
  ]),
  debounceMs: z.number().int().min(0).max(10_000).default(150),
  followSymlinks: z.boolean().default(false),
}).strict();
export type WatcherConfig = z.infer<typeof WatcherConfigSchema>;

export type FileEventBatchListener = (events: FileEvent[]) => void | Promise<void>;

export class WatcherError extends OrqenixError {
  constructor(reason: string) { super(`watcher error: ${reason}`, 'WATCHER'); }
}
