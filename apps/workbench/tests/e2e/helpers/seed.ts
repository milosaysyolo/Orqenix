// SPDX-License-Identifier: Apache-2.0
// Seed deterministic test data for reproducible screenshot baselines.

let seeded = false;

export async function seedWorkbenchData(): Promise<void> {
  if (seeded) return;
  seeded = true;

  const { getRuntime } = await import('@/lib/runtime');
  const rt = await getRuntime();
  const main = 'blake3:branchmain';
  const sess = '01J3X8H9E2ESESS0000000000';

  // 3 decision entries
  await rt.engine.write({
    kb: 'decision', content: 'Use Stripe for billing integration',
    branch_id: main, session_id: sess, memory_level: 'branch',
  });
  await rt.engine.write({
    kb: 'decision', content: 'Adopt capability tokens for cross-scope auth',
    branch_id: main, session_id: sess, memory_level: 'branch',
  });
  await rt.engine.write({
    kb: 'decision', content: 'Local-first SQLite before cloud sync',
    branch_id: main, session_id: sess, memory_level: 'project',
  });

  // 2 sessions
  const { createSession } = await import('@/lib/engine-init');
  createSession('AgentX', 'claude-code');
  createSession('Analyzer', 'custom');

  // 2 marketplace plugins
  const { createPluginItem } = await import('@/lib/engine-init');
  await createPluginItem({
    name: '@local/test-plugin', description: 'A test plugin for e2e',
    author: 'e2e', version: '0.1.0', enabled: true,
  });
  await createPluginItem({
    name: '@local/visualizer', description: 'Visual regression test plugin',
    author: 'e2e', version: '0.1.0', enabled: true,
  });
}
