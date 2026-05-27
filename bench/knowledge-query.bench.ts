import { openKbDocs } from "@orqenix/kb-docs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function benchKnowledgeQuery(iterations: number): Promise<number[]> {
  const dir = await mkdtemp(join(tmpdir(), "orqenix-kb-bench-"));
  const kb = openKbDocs(join(dir, "kb.sqlite"));

  for (let i = 0; i < 1000; i++) {
    kb.insertDoc({
      id: `doc-${i}`,
      path: `doc-${i}.md`,
      title: `Doc ${i}`,
      content: `lorem ipsum dolor sit amet ${i} consectetur`,
      updatedAt: Date.now(),
    });
  }

  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    kb.query("lorem ipsum");
    const t1 = performance.now();
    samples.push(t1 - t0);
  }

  kb.close();
  await rm(dir, { recursive: true, force: true });
  return samples;
}
