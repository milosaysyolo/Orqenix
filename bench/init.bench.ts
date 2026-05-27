import { bench, describe } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = join(process.cwd(), "..", "packages", "cli", "dist", "index.js");
const BUDGET_MS = 1500;

describe("orqenix init", () => {
  bench(
    `cold start (budget ${BUDGET_MS}ms)`,
    () => {
      const dir = mkdtempSync(join(tmpdir(), "orqenix-bench-"));
      const t0 = Date.now();
      spawnSync("node", [CLI, "init"], { cwd: dir, stdio: "ignore" });
      const dt = Date.now() - t0;
      rmSync(dir, { recursive: true, force: true });
      if (dt > BUDGET_MS) throw new Error(`init took ${dt}ms (budget ${BUDGET_MS}ms)`);
    },
    { time: 5000, iterations: 5 },
  );
});
