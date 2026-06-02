// SPDX-License-Identifier: Apache-2.0
// @bc CS-012 Hooks Contracts
// @gate G14

import { OrqenixError } from '@orqenix/core';

export const HOOK_NAMES = [
  'preCompress', 'postCompress',
  'preDistill', 'postDistill',
  'preRecall', 'postRecall',
  'preInject',
] as const;
export type HookName = (typeof HOOK_NAMES)[number];

export interface BaseHookPayload {
  readonly scopeId: string;
  readonly timestamp: string;
}

export interface PreCompressPayload extends BaseHookPayload {
  readonly event: 'preCompress';
  readonly inputTokens: number;
  readonly contextSize: number;
  readonly strategyId: string;
}

export interface PostCompressPayload extends BaseHookPayload {
  readonly event: 'postCompress';
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly ratio: number;
  readonly strategyId: string;
  readonly preservedTier0Count: number;
  readonly durationMs: number;
}

export interface PreDistillPayload extends BaseHookPayload {
  readonly event: 'preDistill';
  readonly batchSize: number;
}

export interface PostDistillPayload extends BaseHookPayload {
  readonly event: 'postDistill';
  readonly entriesScanned: number;
  readonly memoriesCreated: number;
  readonly durationMs: number;
}

export interface PreRecallPayload extends BaseHookPayload {
  readonly event: 'preRecall';
  readonly query: string;
  readonly k: number;
}

export interface PostRecallPayload extends BaseHookPayload {
  readonly event: 'postRecall';
  readonly query: string;
  readonly memoryIdsReturned: readonly string[];
  readonly durationMs: number;
}

export interface PreInjectPayload extends BaseHookPayload {
  readonly event: 'preInject';
  readonly strategyName: 'A' | 'B' | 'C' | 'D' | 'E';
  readonly memoryCount: number;
}

export type HookPayloadMap = {
  preCompress: PreCompressPayload;
  postCompress: PostCompressPayload;
  preDistill: PostDistillPayload;
  postDistill: PostDistillPayload;
  preRecall: PreRecallPayload;
  postRecall: PostRecallPayload;
  preInject: PreInjectPayload;
};

export type HookListener<T extends HookName> = (payload: HookPayloadMap[T]) => void | Promise<void>;

export class HookError extends OrqenixError {
  constructor(reason: string) { super(`hook error: ${reason}`, 'HOOK'); }
}
