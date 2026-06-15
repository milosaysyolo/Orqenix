// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi } from 'vitest';
import { ImportExportWizard } from '../src/import-export-wizard';

describe('ImportExportWizard', () => {
  it('is a valid React component', () => {
    expect(typeof ImportExportWizard).toBe('function');
  });

  it('renders import mode without crashing', () => {
    const element = ImportExportWizard({
      mode: 'import',
      open: true,
      onClose: vi.fn(),
    });
    expect(element).toBeDefined();
  });

  it('renders export mode without crashing', () => {
    const element = ImportExportWizard({
      mode: 'export',
      open: true,
      pluginName: 'test-plugin',
      onClose: vi.fn(),
    });
    expect(element).toBeDefined();
  });
});
