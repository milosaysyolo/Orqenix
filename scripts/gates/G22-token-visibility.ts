// SPDX-License-Identifier: Apache-2.0
// @gate G22
import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.js";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { MetricsRegistry, METRIC_NAMES } from "@orqenix/telemetry";
import { summarizeMetrics, formatRatioBar } from "@orqenix/smart-compression";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");

class G22 extends GateRunner {
  readonly id = "G22";
  readonly title = "Token Visibility";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G22.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G22.1", "METRIC_NAMES exports canonical strings", () => {
        const expected = [
          "orqenix.compress.tokens_in",
          "orqenix.compress.tokens_out",
          "orqenix.compress.ratio",
          "orqenix.compress.duration_ms",
          "orqenix.compress.tier0_preserved",
        ];
        for (const n of expected) {
          if (!Object.values(METRIC_NAMES).includes(n as any))
            throw new Error(`missing canonical name: ${n}`);
        }
      }),

      await this.check("G22.2", "summarizeMetrics aggregates per-strategy", () => {
        const r = new MetricsRegistry();
        r.counter(METRIC_NAMES.COMPRESS_TOKENS_IN, { scope: "s", strategy: "drop" }).inc(100);
        r.counter(METRIC_NAMES.COMPRESS_TOKENS_OUT, { scope: "s", strategy: "drop" }).inc(40);
        r.counter(METRIC_NAMES.COMPRESS_TOKENS_IN, { scope: "s", strategy: "distill" }).inc(50);
        r.counter(METRIC_NAMES.COMPRESS_TOKENS_OUT, { scope: "s", strategy: "distill" }).inc(20);
        r.histogram(METRIC_NAMES.COMPRESS_RATIO, { scope: "s", strategy: "drop" }).observe(0.4);
        r.histogram(METRIC_NAMES.COMPRESS_DURATION_MS, { scope: "s", strategy: "drop" }).observe(7);
        const sum = summarizeMetrics(r);
        if (sum.totalIn !== 150) throw new Error(`totalIn ${sum.totalIn} != 150`);
        if (sum.totalOut !== 60) throw new Error(`totalOut ${sum.totalOut} != 60`);
        if (sum.perStrategyBreakdown.length !== 2)
          throw new Error("expected 2 strategies in breakdown");
      }),

      await this.check("G22.3", "formatRatioBar renders bar correctly", () => {
        if (formatRatioBar(0, 10) !== "[----------] 0%") throw new Error("0% wrong");
        if (formatRatioBar(0.5, 10) !== "[#####-----] 50%") throw new Error("50% wrong");
        if (formatRatioBar(1, 10) !== "[##########] 100%") throw new Error("100% wrong");
        if (formatRatioBar(2, 10) !== "[##########] 100%") throw new Error("clamping wrong");
      }),

      await this.check("G22.4", "empty registry returns sane defaults", () => {
        const r = new MetricsRegistry();
        const sum = summarizeMetrics(r);
        if (sum.totalIn !== 0 || sum.totalOut !== 0) throw new Error("empty totals wrong");
        if (sum.avgRatio !== 1) throw new Error("empty avgRatio default should be 1");
        if (sum.p95DurationMs !== 0) throw new Error("empty p95 should be 0");
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G22-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G22();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G22 crashed:", e);
  process.exit(2);
});
