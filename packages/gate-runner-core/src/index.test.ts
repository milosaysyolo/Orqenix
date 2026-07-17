// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { GateRunner, type GateCheck, type GateReport } from "./index";

class TestRunner extends GateRunner {
  readonly id = "GTEST";
  readonly title = "Test Gate";
  constructor(private readonly factory: (r: TestRunner) => Promise<GateCheck[]>) {
    super();
  }
  protected loadSpec(): unknown {
    return {};
  }
  protected runChecks(): Promise<GateCheck[]> {
    return this.factory(this);
  }
  protected writeReport(_: GateReport): void {
    /* noop */
  }
  public exposeCheck(id: string, desc: string, fn: () => void | Promise<void>) {
    return this.check(id, desc, fn);
  }
}

describe("GateRunner", () => {
  it("reports pass when all checks pass", async () => {
    const r = new TestRunner(async (self) => [
      await self.exposeCheck("a", "check a", () => {}),
      await self.exposeCheck("b", "check b", async () => {}),
    ]);
    const report = await r.execute();
    expect(report.status).toBe("pass");
    expect(report.summary).toEqual({ total: 2, passed: 2, failed: 0 });
  });

  it("reports fail when all checks fail", async () => {
    const r = new TestRunner(async (self) => [
      await self.exposeCheck("a", "check a", () => {
        throw new Error("boom");
      }),
    ]);
    const report = await r.execute();
    expect(report.status).toBe("fail");
    expect(report.checks[0]!.error?.message).toBe("boom");
  });

  it("reports partial when mixed", async () => {
    const r = new TestRunner(async (self) => [
      await self.exposeCheck("a", "check a", () => {}),
      await self.exposeCheck("b", "check b", () => {
        throw new Error("x");
      }),
    ]);
    const report = await r.execute();
    expect(report.status).toBe("partial");
    expect(report.summary).toEqual({ total: 2, passed: 1, failed: 1 });
  });

  it("records durationMs for each check", async () => {
    const r = new TestRunner(async (self) => [
      await self.exposeCheck("slow", "slow", async () => {
        await new Promise((res) => setTimeout(res, 20));
      }),
    ]);
    const report = await r.execute();
    expect(report.checks[0]!.durationMs).toBeGreaterThanOrEqual(15);
  });
});
