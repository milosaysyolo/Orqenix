import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.js";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  encodeFull,
  decodeFull,
  encodeDelta,
  applyDelta,
  hashBytes,
  reconstructFromChain,
  type DiffEntry,
  type ContentHash,
} from "@orqenix/storage-diff";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");

class G2 extends GateRunner {
  readonly id = "G2";
  readonly title = "Diff-Only Storage";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G2.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G2.1", "storage-sqlite tests pass", () => {
        execSync("pnpm --filter @orqenix/storage-sqlite test", { cwd: REPO_ROOT, stdio: "pipe" });
      }),
      await this.check("G2.2", "storage-diff tests pass", () => {
        execSync("pnpm --filter @orqenix/storage-diff test", { cwd: REPO_ROOT, stdio: "pipe" });
      }),
      await this.check("G2.3", "100 random full encode/decode roundtrips", async () => {
        for (let i = 0; i < 100; i++) {
          const text = `payload ${i} ` + "x".repeat((i * 7) % 200);
          const bytes = new TextEncoder().encode(text);
          const back = await decodeFull(await encodeFull(bytes));
          if (new TextDecoder().decode(back) !== text) throw new Error(`mismatch iter ${i}`);
        }
      }),
      await this.check("G2.4", "50 random delta encode/apply roundtrips", async () => {
        for (let i = 0; i < 50; i++) {
          const a = new TextEncoder().encode(`v${i} alpha ${"a".repeat((i * 3) % 80)}`);
          const b = new TextEncoder().encode(`v${i + 1} beta ${"b".repeat((i * 5) % 80)}`);
          const back = await applyDelta(a, await encodeDelta(a, b));
          if (new TextDecoder().decode(back) !== new TextDecoder().decode(b)) {
            throw new Error(`delta mismatch iter ${i}`);
          }
        }
      }),
      await this.check("G2.5", "20-entry chain reconstructs to final state", async () => {
        const versions = Array.from(
          { length: 20 },
          (_, i) => `version ${i}: ` + "x".repeat(i * 10),
        );
        const entries: DiffEntry[] = [];
        let prevBytes: Uint8Array | null = null;
        let prevHash: ContentHash | null = null;
        for (let i = 0; i < versions.length; i++) {
          const bytes = new TextEncoder().encode(versions[i]);
          const ch = hashBytes(bytes);
          if (i === 0) {
            const payload = await encodeFull(bytes);
            entries.push({
              entryId: `e${i}`,
              baseHash: null,
              contentHash: ch,
              encoding: "full",
              payload,
              sizeBytes: payload.length,
              createdAt: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`,
            });
          } else {
            const payload = await encodeDelta(prevBytes!, bytes);
            entries.push({
              entryId: `e${i}`,
              baseHash: prevHash,
              contentHash: ch,
              encoding: "zstd-delta",
              payload,
              sizeBytes: payload.length,
              createdAt: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`,
            });
          }
          prevBytes = bytes;
          prevHash = ch;
        }
        const reconstructed = await reconstructFromChain(entries);
        if (new TextDecoder().decode(reconstructed) !== versions[versions.length - 1]) {
          throw new Error("chain reconstruction mismatch");
        }
      }),
      await this.check("G2.6", "BLAKE3 content hash determinism (200 runs)", () => {
        const bytes = new TextEncoder().encode("determinism check payload");
        const first = hashBytes(bytes);
        for (let i = 0; i < 200; i++)
          if (hashBytes(bytes) !== first) throw new Error(`non-det iter ${i}`);
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G2-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G2();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G2 crashed:", e);
  process.exit(2);
});
