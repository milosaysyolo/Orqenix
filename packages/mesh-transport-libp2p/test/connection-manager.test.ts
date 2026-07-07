import { describe, it, expect, vi } from "vitest";
import { ConnectionManager } from "../src/connection-manager.js";

function makeFakeNode(): {
  node: {
    addEventListener: EventTarget["addEventListener"];
    removeEventListener: EventTarget["removeEventListener"];
    dispatchEvent: EventTarget["dispatchEvent"];
  };
  emit: (name: string, conn: object) => void;
} {
  const et = new EventTarget();
  return {
    node: {
      addEventListener: et.addEventListener.bind(et),
      removeEventListener: et.removeEventListener.bind(et),
      dispatchEvent: et.dispatchEvent.bind(et),
    },
    emit(name: string, conn: object) {
      et.dispatchEvent(new CustomEvent(name, { detail: conn }));
    },
  };
}

describe("ConnectionManager", () => {
  it("tracks connect/disconnect and reports size", () => {
    const { node, emit } = makeFakeNode();
    const cm = new ConnectionManager();
    cm.attach(node as unknown as Parameters<typeof cm.attach>[0]);

    const c1 = { close: vi.fn(async () => {}) };
    const c2 = { close: vi.fn(async () => {}) };
    emit("connection:open", c1);
    emit("connection:open", c2);
    expect(cm.size()).toBe(2);
    emit("connection:close", c1);
    expect(cm.size()).toBe(1);
  });

  it("closes idle connections after idleTimeoutMs", async () => {
    let nowMs = 0;
    const { node, emit } = makeFakeNode();
    const cm = new ConnectionManager({ idleTimeoutMs: 100, tickIntervalMs: 10, now: () => nowMs });
    cm.attach(node as unknown as Parameters<typeof cm.attach>[0]);

    const c = { close: vi.fn(async () => {}) };
    emit("connection:open", c);
    nowMs = 50;
    cm.touch(c as unknown as Parameters<typeof cm.touch>[0]);

    nowMs = 500;
    await new Promise((res) => setTimeout(res, 50));

    expect(c.close).toHaveBeenCalled();
    await cm.drain();
  });

  it("drains within the grace period during stop", async () => {
    const { node, emit } = makeFakeNode();
    const cm = new ConnectionManager({ stopGracePeriodMs: 50 });
    cm.attach(node as unknown as Parameters<typeof cm.attach>[0]);

    const c = { close: vi.fn(async () => {}) };
    emit("connection:open", c);
    await cm.drain();
    expect(c.close).toHaveBeenCalled();
    expect(cm.size()).toBe(0);
  });
});
