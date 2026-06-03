import { performance } from "node:perf_hooks";

export interface GateCheck {
  id: string;
  description: string;
  status: "pass" | "fail";
  durationMs: number;
  error?: { message: string; stack?: string };
}

export type GateCheckResult = GateCheck;

export interface GateReport {
  gateId: string;
  title: string;
  status: "pass" | "fail" | "partial";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  checks: GateCheck[];
  summary: { total: number; passed: number; failed: number };
}

export abstract class GateRunner {
  abstract readonly id: string;
  abstract readonly title: string;

  protected abstract loadSpec(): unknown;
  protected abstract runChecks(): Promise<GateCheck[]>;
  protected abstract writeReport(report: GateReport): void;

  protected async check(
    id: string,
    description: string,
    fn: () => void | Promise<void>,
  ): Promise<GateCheck> {
    const start = performance.now();
    try {
      await fn();
      return { id, description, status: "pass", durationMs: Math.round(performance.now() - start) };
    } catch (err) {
      const e = err as Error;
      return {
        id,
        description,
        status: "fail",
        durationMs: Math.round(performance.now() - start),
        error: { message: e.message, stack: e.stack },
      };
    }
  }

  async execute(): Promise<GateReport> {
    this.loadSpec();
    const startedAt = new Date().toISOString();
    const startMs = performance.now();
    const checks = await this.runChecks();
    const finishedAt = new Date().toISOString();
    const durationMs = Math.round(performance.now() - startMs);
    const passed = checks.filter((c) => c.status === "pass").length;
    const failed = checks.length - passed;
    const status: GateReport["status"] = failed === 0 ? "pass" : passed === 0 ? "fail" : "partial";
    const report: GateReport = {
      gateId: this.id,
      title: this.title,
      status,
      startedAt,
      finishedAt,
      durationMs,
      checks,
      summary: { total: checks.length, passed, failed },
    };
    this.writeReport(report);
    return report;
  }

  printSummary(report: GateReport): void {
    const icon = (s: "pass" | "fail") => (s === "pass" ? "✓" : "✗");
    const line = "─".repeat(80);
    console.log(line);
    console.log(`Gate ${report.gateId}: ${report.title}`);
    console.log(
      `Status: ${report.status.toUpperCase()}  (${report.summary.passed}/${report.summary.total} passed, ${report.durationMs}ms)`,
    );
    console.log(line);
    for (const c of report.checks) {
      const id = c.id.padEnd(8);
      const desc =
        c.description.length > 55 ? c.description.slice(0, 52) + "..." : c.description.padEnd(55);
      const dur = `${c.durationMs}ms`.padStart(8);
      console.log(`${icon(c.status)} ${id} ${desc} ${dur}`);
      if (c.status === "fail" && c.error) {
        console.log(`    error: ${c.error.message.split("\n")[0]}`);
      }
    }
    console.log(line);
  }
}
