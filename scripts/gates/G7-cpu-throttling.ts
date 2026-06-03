import { GateRunner, type GateCheck, type GateReport } from "@orqenix/gate-runner-core";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CpuThrottle } from "@orqenix/memory-distiller";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");

function spinFor(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) Math.sqrt(Math.random() * 1e6);
}

class G7 extends GateRunner {
  readonly id = "G7";
  readonly title = "Background CPU Throttling";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G7.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G7.1", "throttle unit tests pass", () => {
        execSync("npx vitest run test/throttle.test.ts", {
          cwd: join(REPO_ROOT, "packages/memory-distiller"),
          stdio: "pipe",
        });
      }),

      await this.check("G7.2", "does not sleep when idle", async () => {
        const t = new CpuThrottle(20, 100);
        await new Promise((r) => setTimeout(r, 150));
        const slept = await t.checkAndSleep();
        if (slept !== 0) throw new Error(`unexpected sleep: ${slept}`);
      }),

      await this.check("G7.3", "sleeps when busy loop over 10% target", async () => {
        const t = new CpuThrottle(10, 100);
        spinFor(150);
        const slept = await t.checkAndSleep();
        if (slept <= 0) throw new Error("expected sleep > 0 when CPU exceeded target");
      }),

      await this.check("G7.4", "sleep is bounded (<= 5000ms)", async () => {
        const t = new CpuThrottle(1, 100);
        spinFor(200);
        const slept = await t.checkAndSleep();
        if (slept > 5000) throw new Error(`sleep exceeds cap: ${slept}`);
      }),

      await this.check("G7.5", "reset clears the baseline", async () => {
        const t = new CpuThrottle(20, 100);
        spinFor(80);
        t.reset();
        const m = t.measure();
        if (m.elapsedMs > 60)
          throw new Error(`reset did not clear baseline: elapsed=${m.elapsedMs}`);
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G7-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G7();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G7 crashed:", e);
  process.exit(2);
});
