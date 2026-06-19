import Database from 'better-sqlite3';
import { blake3 } from '@noble/hashes/blake3';
import { MemoryEngine } from '@orqenix/memory-engine';
import { BenchSuite } from '../src/harness';
import { SLO_TARGETS } from '../src/slo-targets';

const PROJECT = 'blake3:bench00000000000003';

export async function runPhase3(): Promise<BenchSuite> {
  const suite = new BenchSuite('Phase 3 (Storage)');

  const buf1k = new TextEncoder().encode('x'.repeat(1024));
  await suite.run(
    {
      name: 'blake3.hash.1kb', iterations: 10000, warmup: 100,
      sloP95Ms: SLO_TARGETS['p3.blake3.hash.1kb']!.p95Ms,
      sloMinOpsPerSec: SLO_TARGETS['p3.blake3.hash.1kb']!.minOpsPerSec,
    },
    () => { blake3(buf1k); }
  );

  const buf64k = new TextEncoder().encode('x'.repeat(65536));
  await suite.run(
    {
      name: 'blake3.hash.64kb', iterations: 3000, warmup: 50,
      sloP95Ms: SLO_TARGETS['p3.blake3.hash.64kb']!.p95Ms,
    },
    () => { blake3(buf64k); }
  );

  let engine!: MemoryEngine;
  let counter = 0;
  await suite.run(
    {
      name: 'blob.put.new', iterations: 2000, warmup: 30,
      sloP95Ms: SLO_TARGETS['p3.blob.put.new']!.p95Ms,
      setup: async () => { engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true }); },
      teardown: () => engine.close(),
    },
    () => { engine.getStore().blobs.put('unique content ' + counter++ + ' '.repeat(300)); }
  );

  await suite.run(
    {
      name: 'blob.put.dedup', iterations: 5000, warmup: 50,
      sloP95Ms: SLO_TARGETS['p3.blob.put.dedup']!.p95Ms,
      setup: async () => {
        engine = await MemoryEngine.open(':memory:', { projectId: PROJECT, bootstrapBaseTables: true });
        engine.getStore().blobs.put('shared content '.repeat(300));
      },
      teardown: () => engine.close(),
    },
    () => { engine.getStore().blobs.put('shared content '.repeat(300)); }
  );

  return suite;
}
