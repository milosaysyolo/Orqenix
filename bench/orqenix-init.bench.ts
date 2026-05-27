import { execa } from "execa";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, "../packages/cli/dist/index.js");

export async function benchInit(iterations: number): Promise<number[]> {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const dir = await mkdtemp(join(tmpdir(), "orqenix-init-bench-"));
    const t0 = performance.now();
    await execa("node", [CLI, "init", "--yes"], { cwd: dir });
    const t1 = performance.now();
    samples.push(t1 - t0);
    await rm(dir, { recursive: true, force: true });
  }
  return samples;
}
