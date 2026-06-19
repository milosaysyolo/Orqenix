import { NormalizationEngine } from '@orqenix/normalization-engine';
import { ALL_INPUT_ADAPTERS } from '@orqenix/input-adapters';
import { ALL_OUTPUT_ADAPTERS } from '@orqenix/output-adapters';
import { BenchSuite } from '../src/harness';
import { SLO_TARGETS } from '../src/slo-targets';

const NPM_PKG = JSON.stringify({
  name: '@example/git-commit', version: '1.2.0', description: 'Conventional commits',
  license: 'Apache-2.0', main: './dist/plugin.js', keywords: ['git', 'orqenix-plugin'],
  orqenixPlugin: {
    manifestVersion: '1.0', kind: 'skill', compatibility: { orqenix: '~0.8.0' },
    permissions: ['git.write'], external_agent_compat: ['claude-code', 'cursor'],
    tool: { name: 'git_commit', description: 'Creates commit', inputSchema: { type: 'object' } },
    sandboxMode: 'separate_process',
  },
}, null, 2);

export async function runPhase8Norm(): Promise<BenchSuite> {
  const suite = new BenchSuite('Phase 8 (Normalization)');
  const engine = new NormalizationEngine({ inputAdapters: ALL_INPUT_ADAPTERS, outputAdapters: ALL_OUTPUT_ADAPTERS });

  await suite.run(
    {
      name: 'normalize.roundtrip.npm', iterations: 2000, warmup: 50,
      sloP95Ms: SLO_TARGETS['p8.normalize.roundtrip.npm']!.p95Ms,
      sloMinOpsPerSec: SLO_TARGETS['p8.normalize.roundtrip.npm']!.minOpsPerSec,
    },
    async () => {
      const imported = await engine.import({ sourceKind: 'npm', content: NPM_PKG });
      await engine.export(imported.csf, 'npm');
    }
  );

  await suite.run(
    {
      name: 'normalize.import.autodetect', iterations: 1000, warmup: 30,
      sloP95Ms: SLO_TARGETS['p8.normalize.import.autodetect']!.p95Ms,
    },
    async () => { await engine.import({ content: NPM_PKG }); }
  );

  return suite;
}
