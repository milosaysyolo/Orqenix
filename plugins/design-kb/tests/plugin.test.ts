// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { defineKB } from '../src/index';

describe('design-kb reference plugin', () => {
  it('defines a design KB schema with migration ID >= 1000', () => {
    const kb = defineKB();
    expect(kb.kbName).toBe('design');
    expect(kb.migrationId).toBeGreaterThanOrEqual(1000);
  });

  it('includes all required columns', () => {
    const kb = defineKB();
    const colNames = kb.columns.map((c) => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('title');
    expect(colNames).toContain('figma_url');
    expect(colNames).toContain('rationale');
    expect(colNames).toContain('project_id');
  });

  it('generates valid migration SQL', () => {
    const kb = defineKB();
    expect(kb.migrationSql).toContain('CREATE TABLE');
    expect(kb.migrationSql).toContain('design_entries');
    expect(kb.migrationSql).toContain('STRICT');
  });
});
