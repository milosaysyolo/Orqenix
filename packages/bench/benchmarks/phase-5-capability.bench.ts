import { PermissionChecker, validateManifest } from '@orqenix/plugin-core';
import { BenchSuite } from '../src/harness';
import { SLO_TARGETS } from '../src/slo-targets';

export async function runPhase5(): Promise<BenchSuite> {
  const suite = new BenchSuite('Phase 5 (Capability)');

  const checker = new PermissionChecker([
    'scope.read', 'scope.write', 'fs.read:/home/milo', 'fs.write:/home/milo/projects',
    'git.write', 'memory.read:chat', 'memory.write:decision', 'command.execute:limited',
  ]);

  await suite.run(
    {
      name: 'permission.exact', iterations: 200000, warmup: 1000,
      sloP95Ms: SLO_TARGETS['p5.permission.exact']!.p95Ms,
      sloMinOpsPerSec: SLO_TARGETS['p5.permission.exact']!.minOpsPerSec,
    },
    () => { checker.has('git.write'); }
  );

  await suite.run(
    {
      name: 'permission.prefix', iterations: 100000, warmup: 1000,
      sloP95Ms: SLO_TARGETS['p5.permission.prefix']!.p95Ms,
      sloMinOpsPerSec: SLO_TARGETS['p5.permission.prefix']!.minOpsPerSec,
    },
    () => { checker.has('fs.read:/home/milo/projects/orqenix/src'); }
  );

  const validPkg = {
    name: '@example/skill', version: '1.0.0', license: 'Apache-2.0', main: './plugin.js',
    orqenixPlugin: {
      manifestVersion: '1.0', kind: 'skill', compatibility: { orqenix: '~0.8.0' },
      permissions: ['scope.read'], external_agent_compat: ['claude-code'],
      tool: { name: 'test', description: 'Test', inputSchema: { type: 'object' } },
    },
  };
  await suite.run(
    {
      name: 'manifest.validate', iterations: 5000, warmup: 100,
      sloP95Ms: SLO_TARGETS['p5.manifest.validate']!.p95Ms,
    },
    () => { validateManifest(validPkg); }
  );

  return suite;
}
