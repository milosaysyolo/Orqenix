import semver from "semver";

export interface VersionRange {
  raw: string;
  satisfies(v: string): boolean;
  intersect(other: VersionRange): VersionRange | null;
}

export function parseRange(raw: string): VersionRange {
  if (!semver.validRange(raw)) {
    throw new Error(`Invalid semver range: ${raw}`);
  }
  return {
    raw,
    satisfies(v) {
      return semver.satisfies(v, raw);
    },
    intersect(other) {
      return semver.intersects(raw, other.raw) ? this : null;
    },
  };
}

export function bumpRule(
  change:
    | "edit_prompt"
    | "add_optional_input"
    | "add_skill_to_team"
    | "change_required_input"
    | "change_mcp_tool"
    | "change_output_schema"
    | "change_enforcement_to_must"
): "patch" | "minor" | "major" {
  switch (change) {
    case "edit_prompt":
      return "patch";
    case "add_optional_input":
    case "add_skill_to_team":
      return "minor";
    case "change_required_input":
    case "change_mcp_tool":
    case "change_output_schema":
    case "change_enforcement_to_must":
      return "major";
  }
}
