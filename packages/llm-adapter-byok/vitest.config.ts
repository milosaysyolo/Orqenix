// SPDX-License-Identifier: Apache-2.0
import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '../../vitest.config.shared';

const localConfig = defineConfig({
  // Package-specific overrides here (leave empty for default)
});

export default mergeConfig(shared, localConfig);
