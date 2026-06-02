// SPDX-License-Identifier: Apache-2.0
// @bc CS-021 Provenance Chain
// @gate G33.1, G33.2

import { canonicalJson } from '@orqenix/core';
import { hashString, type ContentHash } from '@orqenix/storage-diff';
import {
  ProvenanceTagSchema,
  ProvenanceChainBrokenError, InvalidProvenanceTagError,
  type ProvenanceChain, type ProvenanceTag,
} from './contracts.js';

export function computeChainHash(tags: ProvenanceTag[]): ContentHash {
  return hashString(canonicalJson(tags));
}

function validateTag(tag: ProvenanceTag): void {
  const r = ProvenanceTagSchema.safeParse(tag);
  if (!r.success) throw new InvalidProvenanceTagError(r.error.message);
}

export function buildChain(tags: ProvenanceTag[]): ProvenanceChain {
  if (tags.length === 0) throw new InvalidProvenanceTagError('chain must have at least 1 tag');
  if (tags.length > 32) throw new InvalidProvenanceTagError('chain too long (max 32)');
  for (let i = 0; i < tags.length; i++) validateTag(tags[i]!);
  if (tags[0]!.parentChainHash !== undefined) {
    throw new ProvenanceChainBrokenError('root tag must not have parentChainHash');
  }
  for (let i = 1; i < tags.length; i++) {
    const expectedParent = computeChainHash(tags.slice(0, i));
    if (tags[i]!.parentChainHash !== expectedParent) {
      throw new ProvenanceChainBrokenError(
        `tag ${i} parentChainHash ${tags[i]!.parentChainHash?.slice(0, 12)}... does not match expected ${expectedParent.slice(0, 12)}...`,
      );
    }
  }
  return { tags, chainHash: computeChainHash(tags) };
}

export function verifyChain(chain: ProvenanceChain): void {
  const rebuilt = buildChain(chain.tags);
  if (rebuilt.chainHash !== chain.chainHash) {
    throw new ProvenanceChainBrokenError(
      `chainHash mismatch: stored=${chain.chainHash.slice(0, 12)}... computed=${rebuilt.chainHash.slice(0, 12)}...`,
    );
  }
}

export function appendTag(chain: ProvenanceChain, newTag: Omit<ProvenanceTag, 'parentChainHash'>): ProvenanceChain {
  const tag: ProvenanceTag = { ...newTag, parentChainHash: chain.chainHash };
  return buildChain([...chain.tags, tag]);
}

export function rootTag(opts: Omit<ProvenanceTag, 'parentChainHash'>): ProvenanceChain {
  const tag: ProvenanceTag = { ...opts };
  return buildChain([tag]);
}
