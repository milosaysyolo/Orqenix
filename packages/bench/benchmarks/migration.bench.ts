import Database from 'better-sqlite3';
import { HIERARCHY_MIGRATIONS, MARKETPLACE_MIGRATIONS, MigrationRunner, BASE_KB_BOOTSTRAP } from '@orqenix/memory-engine';
import { SELF_LEARNING_MIGRATIONS } from '@orqenix/self-learning-observer';
import { BenchSuite } from '../src/harness';
import { SLO_TARGETS } from '../src/slo-targets';

export async function runMigration(): Promise<BenchSuite> {
  const suite = new BenchSuite('Migration');
  const all = [...HIERARCHY_MIGRATIONS, ...MARKETPLACE_MIGRATIONS, ...SELF_LEARNING_MIGRATIONS].sort((a, b) => a.id - b.id);

  await suite.run(
    {
      name: 'migration.apply.all', iterations: 100, warmup: 10,
      sloP95Ms: SLO_TARGETS['mig.apply.all']!.p95Ms,
    },
    () => {
      const db = new Database(':memory:');
      db.exec(BASE_KB_BOOTSTRAP);
      new MigrationRunner(db).apply(all);
      db.close();
    }
  );

  return suite;
}
