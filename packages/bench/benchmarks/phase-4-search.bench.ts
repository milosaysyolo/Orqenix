import { MemoryEngine } from '@orqenix/memory-engine';
import { BenchSuite } from '../src/harness';
import { SLO_TARGETS } from '../src/slo-targets';

const PROJECT = 'blake3:bench00000000000004';
const BRANCH = 'blake3:main0000000000aabb';

const WORDS = ['billing', 'stripe', 'auth', 'oauth', 'github', 'deploy', 'cache', 'index', 'query', 'token', 'session', 'branch', 'plugin', 'mesh'];
function randomDoc(i: number): string {
  const n = 8 + (i % 12);
  let s = '';
  for (let j = 0; j < n; j++) s += WORDS[(i + j) % WORDS.length] + ' ';
  return s.trim();
}

async function seedCorpus(engine: MemoryEngine, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await engine.write({ kb: 'decision', content: randomDoc(i), branch_id: BRANCH, memory_level: 'branch' });
  }
}

export async function runPhase4(): Promise<BenchSuite> {
  const suite = new BenchSuite('Phase 4 (Search)');

  const a = new Float32Array(384).map(() => Math.random());
  const b = new Float32Array(384).map(() => Math.random());
  function cosine(x: Float32Array, y: Float32Array): number {
    let dot = 0, nx = 0, ny = 0;
    for (let i = 0; i < x.length; i++) { dot += x[i] * y[i]; nx += x[i] ** 2; ny += y[i] ** 2; }
    return dot / (Math.sqrt(nx) * Math.sqrt(ny));
  }
  await suite.run(
    { name: 'cosine.384dim', iterations: 50000, warmup: 500, sloP95Ms: SLO_TARGETS['p4.cosine.384dim']!.p95Ms },
    () => { cosine(a, b); }
  );

  let engine!: MemoryEngine;
  await suite.run(
    {
      name: 'search.1k', iterations: 300, warmup: 20,
      sloP95Ms: SLO_TARGETS['p4.search.1k']!.p95Ms,
      setup: async () => {
        engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true });
        await seedCorpus(engine, 1000);
      },
      teardown: () => engine.close(),
    },
    async () => { await engine.query({ query: 'billing stripe', kbs: ['decision'], branchId: BRANCH, limit: 20 }); }
  );

  await suite.run(
    {
      name: 'search.10k', iterations: 100, warmup: 10,
      sloP95Ms: SLO_TARGETS['p4.search.10k']!.p95Ms,
      setup: async () => {
        engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true });
        await seedCorpus(engine, 10000);
      },
      teardown: () => engine.close(),
    },
    async () => { await engine.query({ query: 'billing stripe', kbs: ['decision'], branchId: BRANCH, limit: 20 }); }
  );

  return suite;
}
