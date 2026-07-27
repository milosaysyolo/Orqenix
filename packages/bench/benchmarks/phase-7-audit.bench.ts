import { MemoryEngine } from '@orqenix/memory-engine';
import { BenchSuite } from '../src/harness';
import { SLO_TARGETS } from '../src/slo-targets';

const PROJECT = 'blake3:bench00000000000007';
const BRANCH = 'blake3:main0000000000aabb';

export async function runPhase7(): Promise<BenchSuite> {
  const suite = new BenchSuite('Phase 7 (Audit Chain)');
  let engine!: MemoryEngine;
  let counter = 0;

  await suite.run(
    {
      name: 'audit.append', iterations: 2000, warmup: 30,
      sloP95Ms: SLO_TARGETS['p7.audit.append']!.p95Ms,
      sloMinOpsPerSec: SLO_TARGETS['p7.audit.append']!.minOpsPerSec,
      setup: async () => { engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true }); },
      teardown: () => engine.close(),
    },
    async () => { await engine.write({ kb: 'decision', content: `a${counter++}`, branch_id: BRANCH, memory_level: 'branch' }); }
  );

  await suite.run(
    {
      name: 'audit.verify.100', iterations: 200, warmup: 10,
      sloP95Ms: SLO_TARGETS['p7.audit.verify.100']!.p95Ms,
      setup: async () => {
        engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true });
        for (let i = 0; i < 100; i++) await engine.write({ kb: 'decision', content: `v${i}`, branch_id: BRANCH, memory_level: 'branch' });
      },
      teardown: () => engine.close(),
    },
    () => { engine.verifyAuditChain(); }
  );

  await suite.run(
    {
      name: 'audit.verify.1000', iterations: 50, warmup: 5,
      sloP95Ms: SLO_TARGETS['p7.audit.verify.1000']!.p95Ms,
      setup: async () => {
        engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true });
        for (let i = 0; i < 1000; i++) await engine.write({ kb: 'decision', content: `w${i}`, branch_id: BRANCH, memory_level: 'branch' });
      },
      teardown: () => engine.close(),
    },
    () => { engine.verifyAuditChain(); }
  );

  return suite;
}
