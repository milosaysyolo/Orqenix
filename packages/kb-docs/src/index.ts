export { openKbDocs } from "./db.js";
export type { KbDocsHandle } from "./db.js";
export { hybridSearch, hybridRank } from "./hybrid.js";
export type { HybridRetrievalOptions, HybridSearchInput } from "./hybrid.js";
export { gradeAndDiversify } from "./grader.js";
export type { GraderConfig } from "./grader.js";
export type {
  DocRecord,
  FtsHit,
  VecHit,
  HybridHit,
  EmbeddingProvider,
  DocQueryResult,
} from "./types.js";
export type { KbDocsHandle as DocsKB } from "./db.js";
