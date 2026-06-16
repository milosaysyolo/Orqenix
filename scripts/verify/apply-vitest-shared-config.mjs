// SPDX-License-Identifier: Apache-2.0
// Ensures every package with a vitest.config.ts extends vitest.config.shared.ts.
// Idempotent. Skips packages that already extend the shared config.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const cfgs = execSync('git ls-files "packages/*/vitest.config.ts" "apps/*/vitest.config.ts" "plugins/*/vitest.config.ts"', {
  cwd: ROOT, encoding: 'utf-8',
}).split('\n').map((p) => p.trim()).filter(Boolean);

let touched = 0;
for (const rel of cfgs) {
  const abs = join(ROOT, rel);
  const content = await readFile(abs, 'utf-8');
  if (/vitest\.config\.shared/.test(content)) continue;

  const pkgDir = dirname(abs);
  const sharedRel = relative(pkgDir, join(ROOT, 'vitest.config.shared')).replace(/\\/g, '/');

  const merged = `// SPDX-License-Identifier: Apache-2.0
import { defineConfig, mergeConfig } from 'vitest/config';
import shared from '${sharedRel.startsWith('.') ? sharedRel : './' + sharedRel}';

const localConfig = defineConfig({
  // Package-specific overrides here (leave empty for default)
});

export default mergeConfig(shared, localConfig);
`;
  await writeFile(abs, merged);
  console.log(`[shared-config] ${rel} updated`);
  touched += 1;
}

console.log(`\n[apply-vitest-shared-config] ${touched} config(s) updated.`);
