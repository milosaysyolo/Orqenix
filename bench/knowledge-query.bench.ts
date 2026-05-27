import { bench, describe, beforeAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Import your actual KB factory
// import { openKbDocs } from "@orqenix/kb-docs";

const BUDGET_MS = 300;

describe("knowledge query", () => {
  let kb: any;
  beforeAll(async () => {
    const dir = mkdtempSync(join(tmpdir(), "kb-bench-"));
    // kb = await openKbDocs(join(dir, "kb.db"));
    // Seed 1000 chunks of synthetic content
    // for (let i = 0; i < 1000; i++) {
    //   await kb.index(`doc-${i}.md`, `# Title ${i}\n\nbody text about lifecycle, marketplace, knowledge ${i}`);
    // }
  });

  bench(
    `hybrid query over 1k chunks (budget ${BUDGET_MS}ms)`,
    async () => {
      const t0 = Date.now();
      // await kb.query("lifecycle marketplace", 5);
      const dt = Date.now() - t0;
      if (dt > BUDGET_MS) throw new Error(`query took ${dt}ms (budget ${BUDGET_MS}ms)`);
    },
    { time: 5000, iterations: 20 },
  );
});
