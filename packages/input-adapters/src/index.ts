// SPDX-License-Identifier: Apache-2.0
// @orqenix/input-adapters , Public API surface , all 14 input adapters

import { claudeCodeInputAdapter } from "./claude-code";
import { cursorInputAdapter } from "./cursor";
import { codexInputAdapter } from "./codex";
import { opencodeInputAdapter } from "./opencode";
import { mcpInputAdapter } from "./mcp";
import { continueInputAdapter } from "./continue";
import { aiderInputAdapter } from "./aider";
import { clineInputAdapter } from "./cline";
import { npmInputAdapter } from "./npm";
import { githubInputAdapter } from "./github";
import { urlInputAdapter } from "./url";
import { localFileInputAdapter } from "./local-file";
import { privateGitInputAdapter } from "./private-git";
import { userCustomInputAdapter } from "./user-custom";
import type { InputAdapter } from "@orqenix/normalization-engine";

export {
  claudeCodeInputAdapter,
  cursorInputAdapter,
  codexInputAdapter,
  opencodeInputAdapter,
  mcpInputAdapter,
  continueInputAdapter,
  aiderInputAdapter,
  clineInputAdapter,
  npmInputAdapter,
  githubInputAdapter,
  urlInputAdapter,
  localFileInputAdapter,
  privateGitInputAdapter,
  userCustomInputAdapter,
};

/** All 14 input adapters (for engine registration) */
export const ALL_INPUT_ADAPTERS: InputAdapter[] = [
  // Specific format detectors first (higher confidence)
  npmInputAdapter,
  mcpInputAdapter,
  claudeCodeInputAdapter,
  cursorInputAdapter,
  codexInputAdapter,
  opencodeInputAdapter,
  continueInputAdapter,
  aiderInputAdapter,
  clineInputAdapter,
  userCustomInputAdapter,
  // URL/path based
  githubInputAdapter,
  urlInputAdapter,
  privateGitInputAdapter,
  // Lowest confidence fallback
  localFileInputAdapter,
];
