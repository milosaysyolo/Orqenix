import { describe, it, expect, vi } from 'vitest';
import { Dialer } from '../src/dialer.js';

const MA = '/ip4/127.0.0.1/tcp/1/p2p/12D3KooWExamplePeerIdForLanScopeAlpha';

function fakeNodeOk(): { dial: ReturnType<typeof vi.fn> } {
  return { dial: vi.fn(async () => ({ id: 'conn', close: async () => {} })) };
}

function fakeNodeFailN(n: number, thenOk = true): { dial: ReturnType<typeof vi.fn> } {
  let i = 0;
  return {
    dial: vi.fn(async () => {
      if (i++ < n) throw new Error('connect refused');
      if (thenOk) return { id: 'conn', close: async () => {} };
      throw new Error('connect refused');
    }),
  };
}

describe('Dialer', () => {
  it('succeeds on first attempt', async () => {
    const node = fakeNodeOk();
    const d = new Dialer({ backoff: { maxAttempts: 3, baseDelayMs: 1, rand: () => 0.5, sleep: async () => {} } });
    const conn = await d.dial(node as unknown as Parameters<typeof d.dial>[0], MA, { deadlineMs: Date.now() + 1000 });
    expect(conn).toBeDefined();
    expect(node.dial).toHaveBeenCalledTimes(1);
  });

  it('retries up to maxAttempts then throws', async () => {
    const node = fakeNodeFailN(5, false);
    const d = new Dialer({ backoff: { maxAttempts: 3, baseDelayMs: 1, rand: () => 0.5, sleep: async () => {} } });
    await expect(
      d.dial(node as unknown as Parameters<typeof d.dial>[0], MA, { deadlineMs: Date.now() + 1000 }),
    ).rejects.toThrow();
    expect(node.dial).toHaveBeenCalledTimes(3);
  });

  it('recovers after transient failures', async () => {
    const node = fakeNodeFailN(2, true);
    const d = new Dialer({ backoff: { maxAttempts: 3, baseDelayMs: 1, rand: () => 0.5, sleep: async () => {} } });
    const conn = await d.dial(node as unknown as Parameters<typeof d.dial>[0], MA, { deadlineMs: Date.now() + 1000 });
    expect(conn).toBeDefined();
    expect(node.dial).toHaveBeenCalledTimes(3);
  });

  it('stops at deadline', async () => {
    const node = fakeNodeFailN(99, false);
    const d = new Dialer({ backoff: { maxAttempts: 99, baseDelayMs: 1, rand: () => 0.5, sleep: async () => {} } });
    await expect(
      d.dial(node as unknown as Parameters<typeof d.dial>[0], MA, { deadlineMs: Date.now() - 1 }),
    ).rejects.toThrow();
  });

  it('coalesces concurrent dials to the same peer', async () => {
    const node = fakeNodeOk();
    const d = new Dialer({ backoff: { maxAttempts: 1, baseDelayMs: 1, rand: () => 0.5, sleep: async () => {} } });
    const [a, b] = await Promise.all([
      d.dial(node as unknown as Parameters<typeof d.dial>[0], MA, { deadlineMs: Date.now() + 1000 }),
      d.dial(node as unknown as Parameters<typeof d.dial>[0], MA, { deadlineMs: Date.now() + 1000 }),
    ]);
    expect(a).toBe(b);
    expect(node.dial).toHaveBeenCalledTimes(1);
  });
});
