export interface SloTarget { p95Ms: number; minOpsPerSec: number; crTarget?: string }

export const SLO_TARGETS: Record<string, SloTarget> = {
  'p12.memory.write.inline': { p95Ms: 2, minOpsPerSec: 1000 },
  'p12.memory.write.blob': { p95Ms: 5, minOpsPerSec: 300 },
  'p12.memory.fetch.inline': { p95Ms: 1, minOpsPerSec: 5000 },
  'p12.memory.fetch.blob': { p95Ms: 2, minOpsPerSec: 2000 },
  'p3.blob.put.new': { p95Ms: 3, minOpsPerSec: 500 },
  'p3.blob.put.dedup': { p95Ms: 1, minOpsPerSec: 3000 },
  'p3.blake3.hash.1kb': { p95Ms: 0.5, minOpsPerSec: 10000 },
  'p3.blake3.hash.64kb': { p95Ms: 2, minOpsPerSec: 1000 },
  'p4.search.1k': { p95Ms: 25, minOpsPerSec: 50 },
  'p4.search.10k': { p95Ms: 120, minOpsPerSec: 8 },
  'p4.cosine.384dim': { p95Ms: 0.05, minOpsPerSec: 50000 },
  'p5.permission.exact': { p95Ms: 0.01, minOpsPerSec: 500000, crTarget: '<10ms capability verify' },
  'p5.permission.prefix': { p95Ms: 0.05, minOpsPerSec: 100000, crTarget: '<10ms capability verify' },
  'p5.manifest.validate': { p95Ms: 2, minOpsPerSec: 1000 },
  'p6.federation.query.empty': { p95Ms: 50, minOpsPerSec: 50 },
  'p6.discovery.register': { p95Ms: 10, minOpsPerSec: 200 },
  'p7.audit.append': { p95Ms: 3, minOpsPerSec: 500 },
  'p7.audit.verify.100': { p95Ms: 30, minOpsPerSec: 30 },
  'p7.audit.verify.1000': { p95Ms: 250, minOpsPerSec: 4 },
  'p8.hierarchy.query.3level': { p95Ms: 300, minOpsPerSec: 5, crTarget: '<300ms cross-scope query' },
  'p8.branch.deepcopy.1k': { p95Ms: 200, minOpsPerSec: 5 },
  'p8.subagent.invoke.absorb': { p95Ms: 50, minOpsPerSec: 20 },
  'p8.normalize.roundtrip.npm': { p95Ms: 5, minOpsPerSec: 200 },
  'p8.normalize.import.autodetect': { p95Ms: 10, minOpsPerSec: 100 },
  'p8.selflearning.detect.1k': { p95Ms: 150, minOpsPerSec: 6 },
  'mig.apply.all': { p95Ms: 200, minOpsPerSec: 5 },
};

export function sloFor(key: string): SloTarget | null { return SLO_TARGETS[key] ?? null; }
