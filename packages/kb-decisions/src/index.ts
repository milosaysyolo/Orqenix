export const ENTRY_TYPES = [
  "DecisionRecord",
  "LessonLearned",
  "ConversationCheckpoint",
  "Action",
  "RequirementChange",
  "AssumptionMade",
  "ErrorEncountered",
  "UserPreference",
  "RuleEstablished",
  "ApprovalGranted",
  "DiscoveryMade",
  "ConstraintIdentified",
  "TradeoffMade",
] as const;

export type EntryType = typeof ENTRY_TYPES[number];

export interface DecisionEntry {
  id: string;
  type: EntryType;
  scopeId: string;
  agent?: string;
  sessionId?: string;
  timestamp: string;
  title: string;
  body: string;
  enforcement?: "must" | "should" | "may";
  confidence?: number;
  sourceTrail?: Record<string, unknown>;
}

export class DecisionKB {
  static async open(dbPath: string): Promise<DecisionKB> {
    return new DecisionKB(dbPath);
  }

  constructor(_dbPath: string) {
    void _dbPath;
  }

  async append(
    _entry: Omit<DecisionEntry, "id" | "timestamp">,
  ): Promise<string> {
    const id = `decision-${Date.now()}`;
    return id;
  }

  async getById(_id: string): Promise<DecisionEntry | null> {
    return null;
  }

  async listByType(
    _type: EntryType,
    _scope: string,
    _limit?: number,
  ): Promise<DecisionEntry[]> {
    return [];
  }

  async listByDate(
    _from: string,
    _to: string,
    _scope: string,
  ): Promise<DecisionEntry[]> {
    return [];
  }

  async semanticSearch(_query: string, _topK?: number): Promise<DecisionEntry[]> {
    return [];
  }
}
