/**
 * Skill file format (OpenCode-compatible SKILL.md).
 * See CHAPTER 2 and 10 of the spec.
 */

export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
}

export interface SkillFile {
  name: string;
  sourcePath: string;
  frontmatter: SkillFrontmatter;
  body: string;
  contentHash: string;
}
