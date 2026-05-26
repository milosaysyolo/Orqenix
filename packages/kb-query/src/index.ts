import type { DecisionKB } from "@orqenix/kb-decisions";
import type { DocsKB } from "@orqenix/kb-docs";
import type { CodeKB } from "@orqenix/kb-code";

export interface KnowledgeQuery {
  text: string;
  scope: string;
  cluster?: string;
  kbs?: Array<"docs" | "code" | "decisions">;
  topK?: number;
  maxTokens?: number;
  retrieval?: {
    mode: "hybrid" | "dense" | "sparse";
    rerank: boolean;
    grader: boolean;
  };
}

export interface KnowledgeResult {
  kind: "doc" | "code" | "decision";
  id: string;
  text: string;
  score: number;
  meta: Record<string, unknown>;
}

export class KnowledgeQueryEngine {
  constructor(
    private docs: DocsKB,
    private code: CodeKB,
    private decisions: DecisionKB,
  ) {}

  static async create(
    docs: DocsKB,
    code: CodeKB,
    decisions: DecisionKB,
  ): Promise<KnowledgeQueryEngine> {
    return new KnowledgeQueryEngine(docs, code, decisions);
  }

  async query(q: KnowledgeQuery): Promise<KnowledgeResult[]> {
    const kbs = q.kbs ?? ["docs", "code", "decisions"];
    const topK = q.topK ?? 5;
    const results: KnowledgeResult[] = [];

    if (kbs.includes("docs")) {
      const docs = await this.docs.query(q.text, topK);
      for (const doc of docs) {
        results.push({
          kind: "doc",
          id: doc.id,
          text: doc.text,
          score: doc.score,
          meta: {
            path: doc.path,
            heading: doc.heading,
          },
        });
      }
    }

    if (kbs.includes("code")) {
      const code = await this.code.query(q.text, topK);
      for (const item of code) {
        results.push({
          kind: "code",
          id: item.id,
          text: item.name,
          score: item.score,
          meta: {
            path: item.path,
            kind: item.kind,
            name: item.name,
          },
        });
      }
    }

    if (kbs.includes("decisions")) {
      const decisions = await this.decisions.semanticSearch(topK);
      for (const item of decisions) {
        results.push({
          kind: "decision",
          id: item.id,
          text: `${item.title}\n${item.body}`,
          score: item.confidence ?? 0.5,
          meta: {
            type: item.type,
            scopeId: item.scopeId,
            enforcement: item.enforcement,
          },
        });
      }
    }

    if (q.retrieval?.rerank) {
      await this.rerank(q.text, results);
    }

    if (q.retrieval?.grader) {
      await this.grade(q.text, results);
    }

    return this.capByTokens(
      results.sort((a, b) => b.score - a.score),
      q.maxTokens ?? 4000,
    ).slice(0, topK);
  }

  private async rerank(query: string, results: KnowledgeResult[]): Promise<void> {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    for (const result of results) {
      const haystack = `${result.text} ${JSON.stringify(result.meta)}`.toLowerCase();
      const bonus = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 0.1 : 0), 0);
      result.score += bonus;
    }
  }

  private async grade(_query: string, results: KnowledgeResult[]): Promise<void> {
    for (const result of results) {
      const length = result.text.length;
      if (length > 0 && length < 2000) {
        result.score += 0.05;
      }
    }
  }

  private capByTokens(results: KnowledgeResult[], maxTokens: number): KnowledgeResult[] {
    let used = 0;
    const capped: KnowledgeResult[] = [];
    for (const result of results) {
      const approxTokens = Math.ceil(result.text.length / 4);
      if (used + approxTokens > maxTokens) {
        break;
      }
      capped.push(result);
      used += approxTokens;
    }
    return capped;
  }
}
