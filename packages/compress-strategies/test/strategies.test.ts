// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import {
  DropStrategy, SummarizeStrategy, DistillStrategy, CompressChainStrategy,
  Tier0ViolationError, estimateTokens,
  type TaggedMessage, type Conversation, type PreservationTier,
} from '../src';

const SCOPE = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function msg(id: string, role: TaggedMessage['role'], content: string, tier: PreservationTier, createdAtMs: number, sticky?: boolean): TaggedMessage {
  return {
    id, role, content, tier,
    tokens: estimateTokens(content),
    createdAt: new Date(2026, 0, 1, 0, 0, 0, createdAtMs).toISOString(),
    sticky,
  };
}

function conv(messages: TaggedMessage[]): Conversation {
  return { messages, scopeId: SCOPE };
}

describe('DropStrategy', () => {
  it('drops oldest tier-4 first', async () => {
    const c = conv([
      msg('m1', 'system', 'core', 0, 0),
      msg('m2', 'user', 'x'.repeat(400), 4, 100),
      msg('m3', 'assistant', 'y'.repeat(400), 4, 200),
      msg('m4', 'user', 'recent', 1, 300),
    ]);
    const out = await new DropStrategy().apply({
      conversation: c, targetTokens: 110, maxTokens: 200, strategy: 'drop',
    });
    expect(out.conversation.messages.find((m) => m.id === 'm1')).toBeDefined();
    expect(out.conversation.messages.find((m) => m.id === 'm4')).toBeDefined();
    expect(out.droppedMessageIds.length).toBeGreaterThanOrEqual(1);
    expect(out.preservedTier0Count).toBe(1);
  });

  it('preserves tier-0 even when content is huge', async () => {
    const c = conv([
      msg('locked', 'system', 'x'.repeat(2000), 0, 0),
      msg('m2', 'user', 'small', 4, 100),
    ]);
    const out = await new DropStrategy().apply({
      conversation: c, targetTokens: 5, maxTokens: 100, strategy: 'drop',
    });
    expect(out.conversation.messages.find((m) => m.id === 'locked')).toBeDefined();
  });

  it('respects sticky flag', async () => {
    const c = conv([
      msg('m1', 'user', 'x'.repeat(400), 4, 0, true),
      msg('m2', 'user', 'y'.repeat(400), 4, 100),
    ]);
    const out = await new DropStrategy().apply({
      conversation: c, targetTokens: 110, maxTokens: 200, strategy: 'drop',
    });
    expect(out.conversation.messages.find((m) => m.id === 'm1')).toBeDefined();
    expect(out.conversation.messages.find((m) => m.id === 'm2')).toBeUndefined();
  });

  it('no-op when already under target', async () => {
    const c = conv([msg('m1', 'user', 'tiny', 3, 0)]);
    const out = await new DropStrategy().apply({
      conversation: c, targetTokens: 1000, maxTokens: 2000, strategy: 'drop',
    });
    expect(out.droppedMessageIds).toHaveLength(0);
    expect(out.ratio).toBe(1);
  });
});

describe('SummarizeStrategy (local fallback)', () => {
  it('collapses long runs of tier 2-4 messages', async () => {
    const c = conv([
      msg('m1', 'system', 'core', 0, 0),
      msg('m2', 'user', 'first '.repeat(50), 3, 100),
      msg('m3', 'assistant', 'second '.repeat(50), 3, 200),
      msg('m4', 'user', 'third '.repeat(50), 3, 300),
      msg('m5', 'user', 'current question', 1, 400),
    ]);
    const out = await new SummarizeStrategy({ localFallback: true }).apply({
      conversation: c, targetTokens: 150, maxTokens: 300, strategy: 'summarize',
    });
    expect(out.outputTokens).toBeLessThan(out.inputTokens);
    expect(out.summary).toBeDefined();
    expect(out.conversation.messages.find((m) => m.id === 'm1')).toBeDefined();
    expect(out.conversation.messages.find((m) => m.id === 'm5')).toBeDefined();
  });

  it('does not touch tier 0-1 even if all over budget', async () => {
    const c = conv([
      msg('m1', 'system', 'x'.repeat(400), 0, 0),
      msg('m2', 'user', 'y'.repeat(400), 1, 100),
    ]);
    const out = await new SummarizeStrategy({ localFallback: true }).apply({
      conversation: c, targetTokens: 10, maxTokens: 100, strategy: 'summarize',
    });
    expect(out.conversation.messages.find((m) => m.id === 'm1')).toBeDefined();
    expect(out.conversation.messages.find((m) => m.id === 'm2')).toBeDefined();
  });
});

describe('DistillStrategy', () => {
  it('drops tier 3-4 messages, captures drafts', async () => {
    const c = conv([
      msg('m1', 'system', 'sys', 0, 0),
      msg('m2', 'user', 'I prefer Rust', 3, 100),
      msg('m3', 'user', 'noise', 4, 200),
      msg('m4', 'user', 'current', 1, 300),
    ]);
    const captured: any[] = [];
    const strategy = new DistillStrategy({
      extract: (text, sourceId) =>
        text.includes('prefer') ? [{ type: 'preference', content: text, confidence: 0.9, sourceMessageId: sourceId }] : [],
      memoryWriter: async (d) => { captured.push(...d); },
    });
    const out = await strategy.apply({
      conversation: c, targetTokens: 5, maxTokens: 100, strategy: 'distill',
    });
    expect(out.conversation.messages.find((m) => m.id === 'm1')).toBeDefined();
    expect(out.conversation.messages.find((m) => m.id === 'm4')).toBeDefined();
    expect(captured.length).toBeGreaterThanOrEqual(1);
    expect(captured[0].type).toBe('preference');
  });

  it('memoryWriter failure does not break compression', async () => {
    const c = conv([msg('m2', 'user', 'I prefer Rust', 3, 100), msg('m1', 'user', 'q', 1, 200)]);
    const strategy = new DistillStrategy({
      extract: (text, sourceId) => [{ type: 'preference', content: text, confidence: 0.9, sourceMessageId: sourceId }],
      memoryWriter: async () => { throw new Error('writer down'); },
    });
    const out = await strategy.apply({
      conversation: c, targetTokens: 1, maxTokens: 100, strategy: 'distill',
    });
    expect(out.droppedMessageIds.length).toBeGreaterThanOrEqual(1);
  });
});

describe('CompressChainStrategy', () => {
  it('runs drop -> distill -> summarize in order until under target', async () => {
    const c = conv([
      msg('m1', 'system', 'sys', 0, 0),
      msg('m2', 'user',  'x'.repeat(800), 4, 100),
      msg('m3', 'user',  'I prefer Rust ' + 'y'.repeat(800), 3, 200),
      msg('m4', 'assistant', 'recap ' + 'z'.repeat(800), 3, 300),
      msg('m5', 'user',  'recap ' + 'q'.repeat(800), 3, 350),
      msg('m6', 'user',  'current', 1, 400),
    ]);
    const chain = new CompressChainStrategy({
      distill: new DistillStrategy({
        extract: (text, sourceId) =>
          text.includes('prefer') ? [{ type: 'preference', content: text, confidence: 0.9, sourceMessageId: sourceId }] : [],
      }),
      summarize: new SummarizeStrategy({ localFallback: true }),
    });
    const out = await chain.apply({
      conversation: c, targetTokens: 100, maxTokens: 500, strategy: 'compress-chain',
    });
    expect(out.conversation.messages.find((m) => m.id === 'm1')).toBeDefined();
    expect(out.conversation.messages.find((m) => m.id === 'm6')).toBeDefined();
    expect(out.summary).toMatch(/chain:/);
    expect(out.outputTokens).toBeLessThan(out.inputTokens);
  });
});
