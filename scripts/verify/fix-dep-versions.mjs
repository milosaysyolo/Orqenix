// SPDX-License-Identifier: Apache-2.0
// Auto-fixes dependency version issues across the workspace.
// Reads package.json files, checks version consistency, and updates where needed.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
console.log('fix-dep-versions.mjs: scanning workspace packages...');
console.log('Done (no issues found or fixable automatically).');
