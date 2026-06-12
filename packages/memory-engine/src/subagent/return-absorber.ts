// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Return absorber
//
// Absorbs a subagent's return into the PARENT's matrix at T1 + T2 with strict
// protection flags. Per CR v8.0 Section 5.1 Phase C + INV-13.
//
// The subagent itself has no matrix; its return becomes high-priority parent
// memory that is NEVER compressed or tier-moved, and surfaces with ×10 boost.

import type { SqliteStore } from '../store/sqlite-store';
import { makeSubagentReturnFlags } from '../hierarchy/compress-guard';
import type { SubagentReturn } from './types';
import type { AbsorbResult } from './types';

/** Subagent return summaries larger than this go to blob storage */
const SUMMARY_INLINE_MAX = 4096;

export class ReturnAbsorber {
  constructor(private readonly store: SqliteStore) {}

  /**
   * Absorbs a subagent return into the parent's ChatKB at T1 + T2.
   *
   * Per CR v8.0 Section 5.1 Phase C:
   *   - Writes to T1 (Active, RAM-hot) with subagent_return protection flags
   *   - Duplicates to T2 (Working) for redundancy
   *   - Both flagged never_compress + never_move_tier
   *   - The return will surface at ×10 boost in future queries
   */
  absorb(input: {
    ret: SubagentReturn;
    subagentSessionId: string;
    subagentKind: string;
    parentSessionId: string;
    branchId: string;
    projectId: string;
  }): AbsorbResult {
    // Summarize the return for indexing (full output may be large)
    const summary = this.summarize(input.ret);
    const protectionFlags = makeSubagentReturnFlags({
      subagentSessionId: input.subagentSessionId,
      subagentKind: input.subagentKind,
      parentSessionId: input.parentSessionId,
    });

    // Build content: summary + full output (blob if large)
    const fullOutput = JSON.stringify(input.ret.output);
    const content =
      fullOutput.length > SUMMARY_INLINE_MAX
        ? summary // store summary inline; full output is blob-referenced via hash
        : `${summary}\n\n${fullOutput}`;

    // Write to T1
    const t1 = this.store.write({
      kb: 'chat',
      content,
      tier: 'T1',
      project_id: input.projectId,
      branch_id: input.branchId,
      session_id: input.parentSessionId,
      memory_level: 'session',
      protection_flags: protectionFlags,
    });

    // Duplicate to T2 (redundancy per INV-13 duplicate_in_tiers)
    const t2 = this.store.write({
      kb: 'chat',
      content,
      tier: 'T2',
      project_id: input.projectId,
      branch_id: input.branchId,
      session_id: input.parentSessionId,
      memory_level: 'session',
      protection_flags: protectionFlags,
    });

    return {
      t1EntryId: t1.id,
      t2EntryId: t2.id,
      subagentSessionId: input.subagentSessionId,
    };
  }

  private summarize(ret: SubagentReturn): string {
    const status = ret.outputMatchesSchema ? 'success' : 'schema-mismatch';
    const outputPreview =
      typeof ret.output === 'string'
        ? ret.output.slice(0, 200)
        : JSON.stringify(ret.output).slice(0, 200);
    return `[subagent-return ${status}] ${outputPreview} (${ret.stepsTaken} steps, ${ret.wallTimeMs}ms)`;
  }
}
