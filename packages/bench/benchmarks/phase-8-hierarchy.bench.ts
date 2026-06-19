import { MemoryEngine } from '@orqenix/memory-engine';
import { BenchSuite } from '../src/harness';
import { SLO_TARGETS } from '../src/slo-targets';

const PROJECT = 'blake3:bench00000000000008';
const MAIN = 'blake3:main0000000000aabb';
const SESSION = '01J3X8H9BENCHSESSION00000';

export async function runPhase8(): Promise<BenchSuite> {
  const suite = new BenchSuite('Phase 8 (Hierarchy/Branch/Subagent)');
  let engine!: MemoryEngine;

  await suite.run(
    {
      name: 'hierarchy.query.3level', iterations: 200, warmup: 20,
      sloP95Ms: SLO_TARGETS['p8.hierarchy.query.3level']!.p95Ms,
      setup: async () => {
        engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true });
        for (let i = 0; i < 200; i++) await engine.write({ kb: 'decision', content: `session billing ${i}`, branch_id: MAIN, session_id: SESSION, memory_level: 'session' });
        for (let i = 0; i < 200; i++) await engine.write({ kb: 'decision', content: `branch billing ${i}`, branch_id: MAIN, memory_level: 'branch' });
        for (let i = 0; i < 200; i++) await engine.write({ kb: 'decision', content: `project billing ${i}`, branch_id: MAIN, memory_level: 'project' });
      },
      teardown: () => engine.close(),
    },
    async () => { await engine.query({ query: 'billing', sessionId: SESSION, branchId: MAIN, limit: 20 }); }
  );

  await suite.run(
    {
      name: 'branch.deepcopy.1k', iterations: 50, warmup: 5,
      sloP95Ms: SLO_TARGETS['p8.branch.deepcopy.1k']!.p95Ms,
      setup: async () => {
        engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true });
        for (let i = 0; i < 1000; i++) await engine.write({ kb: 'decision', content: `d${i}`, branch_id: MAIN, memory_level: 'branch' });
        return { n: 0 };
      },
      teardown: () => engine.close(),
    },
    async (ctx) => {
      const c = ctx as { n: number };
      await engine.createBranch({ parentBranchId: MAIN, newBranchName: `feature/bench-${c.n++}` });
    }
  );

  await suite.run(
    {
      name: 'subagent.invoke.absorb', iterations: 500, warmup: 30,
      sloP95Ms: SLO_TARGETS['p8.subagent.invoke.absorb']!.p95Ms,
      setup: async () => { engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true }); },
      teardown: () => engine.close(),
    },
    async () => {
      await engine.invokeSubagent({
        parentSessionId: SESSION, branchId: MAIN,
        harness: {
          systemPrompt: 'runner', scopedContext: { entryIds: [], rationale: 'x' },
          goal: 'run', constraints: { maxSteps: 5, maxWallTimeSec: 90, allowedTools: [], forbiddenTools: [] },
          returnSchema: { type: 'object' }, subagentKind: 'test-runner',
        },
        runner: async () => ({ output: { ok: true }, outputMatchesSchema: true, wallTimeMs: 100, stepsTaken: 1 }),
      });
    }
  );

  return suite;
}
