export interface DecisionNode {
  id: string;
  title: string;
  decidedAt: number;
  rationale: string;
  parents: string[];
  tags?: string[];
}

export interface DecisionGraph {
  nodes: Map<string, DecisionNode>;
}
