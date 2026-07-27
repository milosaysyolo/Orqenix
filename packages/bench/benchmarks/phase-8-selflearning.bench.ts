import Database from 'better-sqlite3';
import { Observer, SELF_LEARNING_MIGRATIONS } from '@orqenix/self-learning-observer';
import { BasicDetector } from '@orqenix/self-learning-detection';
import { BenchSuite } from '../src/harness';
import { SLO_TARGETS } from '../src/slo-targets';

const PROJECT = 'blake3:bench00000000000088';

export async function runPhase8SelfLearning(): Promise<BenchSuite> {
  const suite = new BenchSuite('Phase 8 (Self-Learning)');

  await suite.run(
    {
      name: 'selflearning.detect.1k', iterations: 50, warmup: 5,
      sloP95Ms: SLO_TARGETS['p8.selflearning.detect.1k']!.p95Ms,
      setup: () => {
        const db = new Database(':memory:');
        for (const m of SELF_LEARNING_MIGRATIONS) db.exec(m.up);
        const observer = new Observer({ db });
        let t = Date.now();
        for (let s = 0; s < 250; s++) {
          const session = `sess-${s}`;
          for (const action of ['file_edit', 'test_run', 'git_operation', 'tool_call']) {
            observer.capture({
              projectId: PROJECT, sessionId: session, actorKind: 'agent', actorId: 'x',
              actionKind: action, actionPayload: { f: s }, outcomeKind: action === 'tool_call' ? 'success' : null,
              outcomeDurationMs: action === 'tool_call' ? 4000 : null,
            });
          }
        }
        const events = observer.query({ projectId: PROJECT, limit: 2000 });
        const detector = new BasicDetector({ db });
        return { db, detector, events };
      },
      teardown: (ctx) => { (ctx as { db: Database.Database }).db.close(); },
    },
    async (ctx) => {
      const c = ctx as { detector: BasicDetector; events: unknown[] };
      await c.detector.detect({ projectId: PROJECT, events: c.events as never });
    }
  );

  return suite;
}
