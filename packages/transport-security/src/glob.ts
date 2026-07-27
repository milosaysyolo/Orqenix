export interface CompiledPattern {
  readonly raw: string;
  readonly segments: ReadonlyArray<"*" | "**" | { literal: string }>;
}

export function compileGlob(pattern: string): CompiledPattern {
  if (typeof pattern !== "string" || pattern.length === 0) {
    throw new Error("glob: empty pattern");
  }
  const parts = pattern.split(".");
  const out: CompiledPattern["segments"] = parts.map((p) => {
    if (p === "*") return "*";
    if (p === "**") return "**";
    if (p.includes("*"))
      throw new Error(`glob: mixed segment "${p}" not allowed (use whole-segment * or **)`);
    return { literal: p };
  });
  return { raw: pattern, segments: out };
}

export function matches(compiled: CompiledPattern, method: string): boolean {
  if (typeof method !== "string" || method.length === 0) return false;
  const m = method.split(".");
  return matchHelper(compiled.segments, 0, m, 0);
}

function matchHelper(
  pat: CompiledPattern["segments"],
  pi: number,
  parts: string[],
  mi: number,
): boolean {
  while (pi < pat.length) {
    const seg = pat[pi];
    if (seg === "**") {
      if (pi === pat.length - 1) return true;
      for (let take = parts.length - mi; take >= 0; take--) {
        if (matchHelper(pat, pi + 1, parts, mi + take)) return true;
      }
      return false;
    }
    if (mi >= parts.length) return false;
    if (seg === '*') {
      if ((parts[mi]?.length ?? 0) === 0) return false;
      pi++;
      mi++;
      continue;
    }
    if (parts[mi]! !== seg!.literal) return false;
    pi++;
    mi++;
  }
  return mi === parts.length;
}

export function methodAllowed(caps: ReadonlyArray<string>, method: string): boolean {
  for (const c of caps) {
    if (matches(compileGlob(c), method)) return true;
  }
  return false;
}
