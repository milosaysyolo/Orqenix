#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import { parseArgs } from './parser.js';
import { dispatch } from './commands.js';
import { resolve } from 'node:path';

const ORQENIX_ROOT = process.env.ORQENIX_ROOT ?? process.cwd();
const ORQENIX_DB = process.env.ORQENIX_DB ?? resolve(ORQENIX_ROOT, '.orqenix', 'kb.sqlite');
const ORQENIX_SCOPE = process.env.ORQENIX_SCOPE ?? 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await dispatch(
    {
      rootDir: ORQENIX_ROOT,
      dbPath: ORQENIX_DB,
      scopeId: ORQENIX_SCOPE,
      io: { stdout: (s) => process.stdout.write(s + '\n'), stderr: (s) => process.stderr.write(s + '\n') },
    },
    args,
  );
  if (result.output) {
    (result.exitCode === 0 ? process.stdout : process.stderr).write(result.output + '\n');
  }
  process.exit(result.exitCode);
}

main().catch((e) => {
  process.stderr.write(`orqenix crashed: ${(e as Error).message}\n`);
  process.exit(2);
});
