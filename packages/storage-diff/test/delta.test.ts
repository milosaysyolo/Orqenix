import { describe, it, expect } from "vitest";
import { encodeDelta, applyDelta, encodeFull, decodeFull } from "../src/delta";

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

describe("delta", () => {
  it("full round-trip", async () => {
    const t = enc("Hello, Orqenix!");
    expect(dec(await decodeFull(await encodeFull(t)))).toBe("Hello, Orqenix!");
  });

  it("identical base+target produces small delta", async () => {
    const a = enc("abcdef");
    const d = await encodeDelta(a, a);
    expect(d.length).toBeLessThan(50);
    expect(dec(await applyDelta(a, d))).toBe("abcdef");
  });

  it("insertion at end", async () => {
    const a = enc("foo");
    const b = enc("foobar");
    expect(dec(await applyDelta(a, await encodeDelta(a, b)))).toBe("foobar");
  });

  it("deletion at front", async () => {
    const a = enc("xxxfoo");
    const b = enc("foo");
    expect(dec(await applyDelta(a, await encodeDelta(a, b)))).toBe("foo");
  });

  it("random 50 fuzz", async () => {
    for (let i = 0; i < 50; i++) {
      const a = enc("aaa" + i.toString().repeat(5) + "zzz");
      const b = enc("bbb" + (i + 1).toString().repeat(5) + "yyy");
      expect(dec(await applyDelta(a, await encodeDelta(a, b)))).toBe(dec(b));
    }
  });

  it("replacement in middle", async () => {
    const a = enc("the quick brown fox");
    const b = enc("the quick red fox");
    expect(dec(await applyDelta(a, await encodeDelta(a, b)))).toBe("the quick red fox");
  });
});
