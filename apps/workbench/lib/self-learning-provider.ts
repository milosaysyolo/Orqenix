// SPDX-License-Identifier: Apache-2.0
// Workbench , Self-Learning provider , wires observer + detector + promoter

import { Observer, BasicPiiFilter } from '@orqenix/self-learning-observer';
import { BasicDetector, type IDetector } from '@orqenix/self-learning-detection';
import { PromoterService } from '@orqenix/instinct-promoter';
import { SkillGenesis } from '@orqenix/skill-genesis';
import type { MemoryEngine } from '@orqenix/memory-engine';

/**
 * Constructs the self-learning stack bound to the memory-engine SQLite db.
 * Observer uses BasicPiiFilter (production swaps full privacy-core filter).
 * Optionally accepts an AdvancedDetector from the Pro package.
 */
export function buildSelfLearning(
  engine: MemoryEngine,
  advancedDetector?: IDetector
): {
  observer: Observer;
  detector: IDetector;
  promoter: PromoterService;
} {
  const db = engine.getStore().db;
  const observer = new Observer({ db, piiFilter: new BasicPiiFilter() });
  const detector = advancedDetector ?? new BasicDetector({ db });
  const skillGenesis = new SkillGenesis({ db });
  const candidateStore = detector instanceof BasicDetector ? detector.getCandidateStore() : undefined;
  const promoter = new PromoterService({
    db,
    ...(candidateStore !== undefined ? { candidateStore } : {}),
    observer,
    skillGenesis,
    audit: engine.getAuditWriter() as never,
    detector,
  });
  return { observer, detector, promoter };
}
