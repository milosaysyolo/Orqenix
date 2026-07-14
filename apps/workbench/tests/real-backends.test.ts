// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// File: apps/workbench/tests/real-backends.test.ts
// Purpose: Prove the engine-init API helpers back every subsystem with the
//   live MemoryEngine (sessions, plugins, skills, marketplace) — not demo-store.
//   Boots via getMemory() (triggers init()), asserts all subsystems 'real',
//   then round-trips create/list/toggle/delete through the real SQLite DB.
// Run: pnpm --filter @orqenix/workbench vitest run tests/real-backends.test.ts
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';

describe('engine-init real backends', () => {
  beforeAll(() => {
    process.env.ORQENIX_DB = ':memory:';
    process.env.ORQENIX_DEV = '1';
  });

  it('boots all subsystems as real', async () => {
    const { getMemory, getEngineStatus } = await import('../lib/engine-init');
    await getMemory();
    const st = getEngineStatus();
    for (const k of Object.keys(st)) expect(st[k as keyof typeof st], k).toBe('real');
  });

  it('sessions persist through the real store', async () => {
    const { getAllSessions, createSession, pauseExistingSession, resumeExistingSession, abortExistingSession } =
      await import('../lib/engine-init');
    const before = getAllSessions().length;
    const s = createSession('AgentX', 'claude-code');
    expect(s.session_id).toBeTruthy();
    expect(getAllSessions().length).toBe(before + 1);
    expect(pauseExistingSession(s.session_id)).toBe(true);
    expect(resumeExistingSession(s.session_id)).toBe(true);
    expect(abortExistingSession(s.session_id)).toBe(true);
    expect(getAllSessions().some((x) => x.session_id === s.session_id)).toBe(false);
  });

  it('plugins create / toggle / delete on real registry', async () => {
    const { getAllPlugins, createPluginItem, togglePluginItem, deletePluginItem } = await import('../lib/engine-init');
    const p = await createPluginItem({ name: 'my-plugin', description: 'd', author: 'local' });
    expect(p.id).toBe('my-plugin');
    expect((await getAllPlugins()).some((x) => x.id === 'my-plugin')).toBe(true);
    await togglePluginItem('my-plugin');
    await deletePluginItem('my-plugin');
    expect((await getAllPlugins()).some((x) => x.id === 'my-plugin')).toBe(false);
  });

  it('skills create / invoke / delete on real store', async () => {
    const { getAllSkills, createSkillItem, invokeSkill, deleteSkillItem } = await import('../lib/engine-init');
    const sk = await createSkillItem({ name: 'my-skill', description: 'd' });
    expect(sk.id).toBe('my-skill');
    expect((await getAllSkills()).some((x) => x.id === 'my-skill')).toBe(true);
    const inv = await invokeSkill('my-skill', 'hello');
    expect(inv?.ok).toBe(true);
    expect(typeof inv?.output).toBe('string');
    await deleteSkillItem('my-skill');
    expect((await getAllSkills()).some((x) => x.id === 'my-skill')).toBe(false);
  });

  it('marketplace lists real catalog', async () => {
    const { getMarketplaceItems } = await import('../lib/engine-init');
    const { items } = await getMarketplaceItems();
    expect(Array.isArray(items)).toBe(true);
  });
});
