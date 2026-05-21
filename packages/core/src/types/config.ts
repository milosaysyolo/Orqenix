/**
 * Orqenix config (subset shown; Zod schema in config/schema.ts).
 * See CHAPTER 4 of the spec.
 */

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  region?: string;
  profile?: string;
}

export interface RoutingRule {
  when: string;
  model: string;
}

export interface OrqenixConfig {
  version: string;
  providers: Record<string, ProviderConfig>;
  routing: {
    default: string;
    fallback: string;
    perAgent: Record<string, string>;
    rules: RoutingRule[];
  };
  embedding: {
    primary: string;
    fallback: string;
    localFirst: boolean;
    cacheLocal: boolean;
  };
  storage: {
    type: "sqlite" | "postgres";
    path?: string;
    url?: string;
    wal?: boolean;
    vacuumInterval?: string;
  };
  memory: MemoryConfig;
  knowledge: KnowledgeConfig;
  context: ContextConfig;
  scope: ScopeConfig;
  sync: SyncConfig;
  webui: WebUIConfig;
  update: UpdateConfig;
  telemetry: TelemetryConfig;
}

export interface MemoryConfig {
  tiers: {
    working: { ttl: string | null; maxSizeMB: number };
    episodic: { ttl: string; maxSizeMB: number; cleanup: "lru" | "importance" };
    semantic: { ttl: string; maxSizeMB: number; cleanup: "lru" | "importance" };
    global: { enabled: boolean; ttl: string };
  };
  cleanup: {
    mode: "prompt" | "auto" | "manual";
    schedule: "daily" | "weekly" | "monthly" | "manual";
    showPreview: boolean;
    dryRunFirst: boolean;
    protectMarked: boolean;
    protectCheckpoints: boolean;
  };
}

export interface KnowledgeConfig {
  preTask: {
    autoQuery: boolean;
    maxBriefingTokens: number;
    includeKbs: Array<"decisions" | "docs" | "code">;
  };
  postTask: {
    autoReindex: boolean;
    captureDecisions: boolean;
    detectionMode: "filesystem" | "declared" | "hybrid";
  };
  indexing: {
    mode: "incremental" | "full";
    batchSize: number;
    parallelism: number;
    debounceMs: number;
  };
}

export interface ContextConfig {
  lazyLoader: { enabled: boolean };
  picker: { topN: number; minScore: number; diversity: boolean };
  compressInput: {
    enabled: boolean;
    mode: "soft" | "rewrite" | "aggressive";
    removeWhitespaceNoise: boolean;
    deduplicate: boolean;
    rewriteToPseudoCode: boolean;
    instructConcision: boolean;
    maxRewriteTokens: number;
    preserveCodeBlocks: boolean;
    preserveQuotes: boolean;
  };
  compressOutput: {
    enabled: boolean;
    thresholdTokens: number;
    typeAware: boolean;
    preserveHandles: boolean;
  };
  compressContext: {
    enabled: boolean;
    mode: "smart" | "aggressive" | "manual";
    minTokensTrigger: number;
    maxTokensTrigger: number;
    triggers: {
      onTaskComplete: boolean;
      onMilestone: boolean;
      onContextPressure: boolean;
      onTopicShift: boolean;
      onIdle: boolean;
    };
    preserve: {
      decisionKB: boolean;
      docsKB: boolean;
      codeKB: boolean;
      userMessages: boolean;
      checkpoints: boolean;
      protectedTags: boolean;
    };
    protectPatterns: string[];
  };
}

export interface ScopeConfig {
  sessionDetection: string[];
  autoDetectGit: boolean;
}

export interface SyncConfig {
  enabled: boolean;
  mode: "auto" | "manual";
  syncOnSave: boolean;
  syncOnStartup: boolean;
  conflictResolution: "orqenix-wins" | "opencode-wins" | "prompt";
  preserveOpenCodeUserEdits: boolean;
  outputMarker: boolean;
}

export interface WebUIConfig {
  enabled: boolean;
  port: number;
  host: string;
  domainBridge: string;
  openOnStart: boolean;
}

export interface UpdateConfig {
  channel: "stable" | "beta" | "nightly";
  mode: "auto" | "prompt" | "manual";
  checkInterval: string;
}

export interface TelemetryConfig {
  enabled: boolean;
  anonymizeId: boolean;
}
