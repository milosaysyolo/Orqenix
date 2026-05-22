import type { DiscoveredSkill } from "./discovery.js";

export interface RankingInput {
  query: string;
  skills: DiscoveredSkill[];
  topN?: number;
}

export interface RankedSkill {
  skill: DiscoveredSkill;
  score: number;
  reason: string;
}

export function rankSkills(input: RankingInput): RankedSkill[] {
  const query = input.query.toLowerCase();
  const topN = input.topN ?? 5;

  const scored = input.skills.map((s) => {
    const text = `${s.skill.frontmatter.name} ${s.skill.frontmatter.description}`.toLowerCase();
    let score = 0;
    const reasons: string[] = [];

    if (text.includes(query)) {
      score += 10;
      reasons.push("exact-phrase");
    }
    const qTokens = query.split(/\s+/).filter((t) => t.length > 2);
    const tTokens = new Set(text.split(/\s+/));
    let overlap = 0;
    for (const qt of qTokens) {
      if (tTokens.has(qt)) overlap++;
    }
    if (overlap > 0) {
      score += overlap;
      reasons.push(`tokens:${overlap}`);
    }
    if (s.source.type.startsWith("project-")) {
      score += 2;
      reasons.push("project-priority");
    }

    return { skill: s, score, reason: reasons.join(",") };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
