import { MemoryEngine } from '@orqenix/memory-engine';
import { BenchSuite } from '../src/harness';
import { SLO_TARGETS } from '../src/slo-targets';

const PROJECT = 'blake3:bench00000000000012';
const BRANCH = 'blake3:main0000000000aabb';

export async function runPhase12(): Promise<BenchSuite> {
  const suite = new BenchSuite('Phase 1-2 (Memory Core)');
  let engine!: MemoryEngine;
  let counter = 0;

  await suite.run(
    {
      name: 'memory.write.inline', iterations: 2000, warmup: 50,
      sloP95Ms: SLO_TARGETS['p12.memory.write.inline']!.p95Ms,
      sloMinOpsPerSec: SLO_TARGETS['p12.memory.write.inline']!.minOpsPerSec,
      setup: async () => { engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true }); },
      teardown: () => engine.close(),
    },
    async () => {
      await engine.write({ kb: 'decision', content: `decision ${counter++}`, branch_id: BRANCH, memory_level: 'branch' });
    }
  );

  const bigContent = 'x'.repeat(8000);
  await suite.run(
    {
      name: 'memory.write.blob', iterations: 1000, warmup: 30,
      sloP95Ms: SLO_TARGETS['p12.memory.write.blob']!.p95Ms,
      setup: async () => { engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true }); },
      teardown: () => engine.close(),
    },
    async () => {
      await engine.write({ kb: 'code', content: bigContent + counter++, branch_id: BRANCH, memory_level: 'branch' });
    }
  );

  await suite.run(
    {
      name: 'memory.fetch.inline', iterations: 5000, warmup: 50,
      sloP95Ms: SLO_TARGETS['p12.memory.fetch.inline']!.p95Ms,
      setup: async () => {
        engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true });
        const ids: string[] = [];
        for (let i = 0; i < 100; i++) {
          const e = await engine.write({ kb: 'chat', content: `c${i}`, branch_id: BRANCH, memory_level: 'branch' });
          ids.push(e.id);
        }
        return ids;
      },
      teardown: () => engine.close(),
    },
    async (ctx, i) => {
      const ids = ctx as string[];
      engine.fetchContent('chat', ids[i % ids.length]);
    }
  );

  return suite;
}
