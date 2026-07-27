import { describe, it, expect, beforeAll } from 'vitest';

describe('Workbench runtime wiring', () => {
  beforeAll(() => {
    process.env.ORQENIX_DB = ':memory:';
    process.env.ORQENIX_DEV = '1';
  });

  it('constructs the runtime with all services', async () => {
    const { getRuntime } = await import('../lib/runtime');
    const rt = await getRuntime();
    expect(rt.engine).toBeDefined();
    expect(rt.observer).toBeDefined();
    expect(rt.detector).toBeDefined();
    expect(rt.promoter).toBeDefined();
    expect(rt.marketplace).toBeDefined();
    expect(rt.settings).toBeDefined();
    expect(rt.normalization).toBeDefined();
    expect(rt.projectId).toBeTruthy();
  });

  it('audit chain verifies on a fresh db', async () => {
    const { getRuntime } = await import('../lib/runtime');
    const rt = await getRuntime();
    expect(rt.engine.verifyAuditChain().valid).toBe(true);
  });
});