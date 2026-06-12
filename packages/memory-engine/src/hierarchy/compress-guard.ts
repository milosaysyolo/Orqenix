// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Compress guard (INV-13)
//
// Enforces protection_flags so subagent returns + pinned entries are NEVER
// compressed or tier-moved. These guards are the 1-line additions that
// extend Phase 2 compress engine + Phase 4 tier mover per CR v8.0 Section 3.5.

import type { MemoryEntry, ProtectionFlags } from '../store/types';

/**
 * Returns whether an entry is eligible for compression.
 *
 * Per INV-13 + Anti-pattern 32: entries with protection_flags.never_compress
 * are NEVER compressed. Subagent returns are by definition high-value.
 */
export function shouldCompress(
  entry: MemoryEntry,
  cooldownSec = 60
): boolean {
  // INV-13 guard
  if (entry.protection_flags?.never_compress) {
    return false;
  }

  // Cooldown: don't compress entries created in the last N seconds
  const ageMs = Date.now() - new Date(entry.created_at).getTime();
  if (ageMs < cooldownSec * 1000) {
    return false;
  }

  return true;
}

/**
 * Returns whether an entry is eligible for tier movement.
 *
 * Per INV-13 + Anti-pattern 32: entries with protection_flags.never_move_tier
 * stay in their tier forever. Subagent returns stay in T1+T2.
 */
export function shouldMoveTier(entry: MemoryEntry): boolean {
  // INV-13 guard
  if (entry.protection_flags?.never_move_tier) {
    return false;
  }
  return true;
}

/**
 * Validates that a protection_flags object is well-formed.
 */
export function validateProtectionFlags(
  flags: ProtectionFlags
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (flags.kind === 'subagent_return') {
    if (!flags.never_compress) {
      errors.push('subagent_return must have never_compress=true (INV-13)');
    }
    if (!flags.never_move_tier) {
      errors.push('subagent_return must have never_move_tier=true (INV-13)');
    }
    if (!flags.subagent_session_id) {
      errors.push('subagent_return must declare subagent_session_id');
    }
    if (!flags.parent_session_id) {
      errors.push('subagent_return must declare parent_session_id');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Creates a subagent_return protection flag object (used by return-absorber).
 */
export function makeSubagentReturnFlags(input: {
  subagentSessionId: string;
  subagentKind: string;
  parentSessionId: string;
}): ProtectionFlags {
  return {
    kind: 'subagent_return',
    immutable: true,
    never_compress: true,
    never_move_tier: true,
    duplicate_in_tiers: ['T1', 'T2'],
    subagent_session_id: input.subagentSessionId,
    subagent_kind: input.subagentKind,
    parent_session_id: input.parentSessionId,
    returned_at: new Date().toISOString(),
  };
}
