import { describe, it, expect } from "vitest";
import { CpuThrottle } from "../src/throttle";

function spinFor(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    Math.sqrt(Math.random() * 1e6);
  }
}

describe("CpuThrottle", () => {
  it("rejects invalid target", () => {
    expect(() => new CpuThrottle(0)).toThrow();
    expect(() => new CpuThrottle(101)).toThrow();
  });

  it("does not sleep when under target", () => {
    const t = new CpuThrottle(90, 50);
    t.reset();
    const slept = t.checkAndSleep();
    // Must resolve synchronously — no CPU time accumulated yet
    return expect(slept).resolves.toBe(0);
  });

  it("sleeps proportionally when over target (busy loop ~100% CPU)", async () => {
    const t = new CpuThrottle(10, 100);
    spinFor(120);
    const slept = await t.checkAndSleep();
    expect(slept).toBeGreaterThan(0);
  });

  it("measure returns reasonable shape", () => {
    const t = new CpuThrottle(20);
    spinFor(50);
    const m = t.measure();
    expect(m.elapsedMs).toBeGreaterThan(0);
    expect(m.cpuMs).toBeGreaterThanOrEqual(0);
    expect(m.percent).toBeGreaterThanOrEqual(0);
  });

  it("reset clears baseline", () => {
    const t = new CpuThrottle(20);
    spinFor(50);
    t.reset();
    const m = t.measure();
    expect(m.elapsedMs).toBeLessThan(50);
  });
});
