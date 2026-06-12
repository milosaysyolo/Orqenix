// SPDX-License-Identifier: Apache-2.0
// @orqenix/output-adapters , Public API surface , all 8 output adapters

import { claudeCodeOutputAdapter } from './claude-code';
import { cursorOutputAdapter } from './cursor';
import { codexOutputAdapter } from './codex';
import { opencodeOutputAdapter } from './opencode';
import { mcpOutputAdapter } from './mcp';
import { continueOutputAdapter } from './continue';
import { aiderOutputAdapter } from './aider';
import { npmOutputAdapter } from './npm';
import type { OutputAdapter } from '@orqenix/normalization-engine';

export {
  claudeCodeOutputAdapter,
  cursorOutputAdapter,
  codexOutputAdapter,
  opencodeOutputAdapter,
  mcpOutputAdapter,
  continueOutputAdapter,
  aiderOutputAdapter,
  npmOutputAdapter,
};

/** All 8 output adapters (for engine registration) */
export const ALL_OUTPUT_ADAPTERS: OutputAdapter[] = [
  claudeCodeOutputAdapter,
  cursorOutputAdapter,
  codexOutputAdapter,
  opencodeOutputAdapter,
  mcpOutputAdapter,
  continueOutputAdapter,
  aiderOutputAdapter,
  npmOutputAdapter,
];
