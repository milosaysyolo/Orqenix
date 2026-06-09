import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MeshDiscovery } from '../src/discovery.js';

describe('MeshDiscovery retry edge cases (FK-1.1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries scheduleBootstrapAttempt with exponential backoff until success', async () => {
    const d = new MeshDiscovery({
      bootstrap: {
        bootstrap: ['/ip4/127.0.0.1/tcp/1/p2p/12D3KooWFakePeer'],
        reconnect: {
          initialDelayMs: 100,
          maxDelayMs: 10_000,
          backoffFactor: 2,
          jitter: false,
        },
      },
    });

    let attempts = 0;
    const attemptFn = vi.fn(async () => {
      attempts++;
      return attempts >= 3;
    });

    d.scheduleBootstrapAttempt(
      '/ip4/127.0.0.1/tcp/1/p2p/12D3KooWFakePeer',
      attemptFn,
      () => 0.5,
    );

    await vi.advanceTimersByTimeAsync(150);
    expect(attempts).toBe(1);

    await vi.advanceTimersByTimeAsync(250);
    expect(attempts).toBe(2);

    await vi.advanceTimersByTimeAsync(450);
    expect(attempts).toBe(3);

    expect(attemptFn).toHaveBeenCalledTimes(3);

    d.stop();
  });

  it('caps backoff at maxDelayMs after enough failures', async () => {
    const d = new MeshDiscovery({
      bootstrap: {
        bootstrap: ['/ip4/127.0.0.1/tcp/2/p2p/12D3KooWFakePeer'],
        reconnect: {
          initialDelayMs: 100,
          maxDelayMs: 500,
          backoffFactor: 2,
          jitter: false,
        },
      },
    });

    let attempts = 0;
    const attemptFn = vi.fn(async () => {
      attempts++;
      return false;
    });

    d.scheduleBootstrapAttempt(
      '/ip4/127.0.0.1/tcp/2/p2p/12D3KooWFakePeer',
      attemptFn,
      () => 0.5,
    );

    await vi.advanceTimersByTimeAsync(150);
    await vi.advanceTimersByTimeAsync(250);
    await vi.advanceTimersByTimeAsync(450);
    await vi.advanceTimersByTimeAsync(550);
    await vi.advanceTimersByTimeAsync(550);

    expect(attempts).toBe(5);

    d.stop();
  });

  it('stops scheduling new attempts after MeshDiscovery.stop()', async () => {
    const d = new MeshDiscovery({
      bootstrap: {
        bootstrap: ['/ip4/127.0.0.1/tcp/3/p2p/12D3KooWFakePeer'],
        reconnect: {
          initialDelayMs: 50,
          maxDelayMs: 1_000,
          backoffFactor: 2,
          jitter: false,
        },
      },
    });

    let attempts = 0;
    const attemptFn = vi.fn(async () => {
      attempts++;
      return false;
    });

    d.scheduleBootstrapAttempt(
      '/ip4/127.0.0.1/tcp/3/p2p/12D3KooWFakePeer',
      attemptFn,
      () => 0.5,
    );

    await vi.advanceTimersByTimeAsync(100);
    expect(attempts).toBe(1);

    d.stop();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(attempts).toBe(1);
  });

  it('attempt counter resets on success path', async () => {
    const d = new MeshDiscovery({
      bootstrap: {
        bootstrap: ['/ip4/127.0.0.1/tcp/4/p2p/12D3KooWFakePeer'],
        reconnect: {
          initialDelayMs: 100,
          maxDelayMs: 10_000,
          backoffFactor: 2,
          jitter: false,
        },
      },
    });

    let outcomes = [false, false, true];
    let i = 0;
    const attemptFn = vi.fn(async () => outcomes[i++ % outcomes.length]);

    d.scheduleBootstrapAttempt(
      '/ip4/127.0.0.1/tcp/4/p2p/12D3KooWFakePeer',
      attemptFn,
      () => 0.5,
    );

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(250);
    await vi.advanceTimersByTimeAsync(450);

    expect(attemptFn).toHaveBeenCalledTimes(3);

    d.stop();
  });
});
