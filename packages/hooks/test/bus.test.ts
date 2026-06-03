// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { HookBus, nowIso, type PostCompressPayload } from '../src';

const SCOPE = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function pcPayload(over: Partial<PostCompressPayload> = {}): PostCompressPayload {
  return {
    event: 'postCompress', scopeId: SCOPE, timestamp: nowIso(),
    inputTokens: 1000, outputTokens: 500, ratio: 0.5,
    strategyId: 'tier-compact', preservedTier0Count: 3, durationMs: 12,
    ...over,
  };
}

describe('HookBus', () => {
  it('subscribes and emits a single listener', async () => {
    const bus = new HookBus();
    const received: PostCompressPayload[] = [];
    bus.on('postCompress', (p) => { received.push(p); });
    await bus.emit('postCompress', pcPayload());
    expect(received).toHaveLength(1);
    expect(received[0].ratio).toBe(0.5);
  });

  it('supports multiple listeners on the same event', async () => {
    const bus = new HookBus();
    let count = 0;
    bus.on('postCompress', () => { count++; });
    bus.on('postCompress', () => { count++; });
    bus.on('postCompress', () => { count++; });
    await bus.emit('postCompress', pcPayload());
    expect(count).toBe(3);
  });

  it('unsubscribe via returned function', async () => {
    const bus = new HookBus();
    let count = 0;
    const off = bus.on('postCompress', () => { count++; });
    off();
    await bus.emit('postCompress', pcPayload());
    expect(count).toBe(0);
  });

  it('isolates listener errors (one throwing does not block others)', async () => {
    const bus = new HookBus();
    let aRan = false, bRan = false;
    const errors: unknown[] = [];
    bus.onError((_, e) => errors.push(e));
    bus.on('postCompress', () => { aRan = true; throw new Error('boom'); });
    bus.on('postCompress', () => { bRan = true; });
    await bus.emit('postCompress', pcPayload());
    expect(aRan).toBe(true);
    expect(bRan).toBe(true);
    expect(errors).toHaveLength(1);
  });

  it('awaits async listeners before emit resolves', async () => {
    const bus = new HookBus();
    let done = false;
    bus.on('postCompress', async () => {
      await new Promise((r) => setTimeout(r, 30));
      done = true;
    });
    await bus.emit('postCompress', pcPayload());
    expect(done).toBe(true);
  });

  it('emit with no listeners is safe', async () => {
    const bus = new HookBus();
    await expect(bus.emit('postCompress', pcPayload())).resolves.toBeUndefined();
  });

  it('listenerCount + clear', () => {
    const bus = new HookBus();
    bus.on('postCompress', () => {});
    bus.on('postCompress', () => {});
    bus.on('postDistill', () => {});
    expect(bus.listenerCount('postCompress')).toBe(2);
    bus.clear('postCompress');
    expect(bus.listenerCount('postCompress')).toBe(0);
    expect(bus.listenerCount('postDistill')).toBe(1);
    bus.clear();
    expect(bus.listenerCount('postDistill')).toBe(0);
  });

  it('typed payload (compile-time check, runtime smoke)', async () => {
    const bus = new HookBus();
    bus.on('postDistill', (p) => {
      expect(p.event).toBe('postDistill');
      expect(p.entriesScanned).toBe(7);
    });
    await bus.emit('postDistill', {
      event: 'postDistill', scopeId: SCOPE, timestamp: nowIso(),
      entriesScanned: 7, memoriesCreated: 3, durationMs: 10,
    });
  });
});
