export interface MarketplaceManifest {
  schemaVersion?: number;
  name: string;
  owner: { name: string };
  plugins: PluginEntry[];
}

export type PluginEntry = InTreePlugin | ExternalPlugin | GitSubdirPlugin;

export interface InTreePlugin {
  name: string;
  displayName?: string;
  description: string;
  source: string; // relative path
  category?: string;
}

export interface ExternalPlugin {
  name: string;
  displayName?: string;
  description: string;
  source: {
    source: "url";
    url: string;
    sha: string;
  };
  author?: { name: string };
  category?: string;
  homepage?: string;
}

export interface GitSubdirPlugin {
  name: string;
  displayName?: string;
  description: string;
  source: {
    source: "git-subdir";
    url: string;
    path: string;
    ref: string;
    sha: string;
  };
  author?: { name: string };
  category?: string;
}

export type ValidationError =
  | { kind: "missing-field"; field: string }
  | { kind: "invalid-sha"; name: string }
  | { kind: "duplicate-name"; name: string }
  | { kind: "invalid-source"; name: string };

export function validateManifest(
  m: unknown
): { ok: true } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  if (typeof m !== "object" || m === null) {
    return { ok: false, errors: [{ kind: "missing-field", field: "root" }] };
  }
  const mm = m as Partial<MarketplaceManifest>;
  if (!mm.name) errors.push({ kind: "missing-field", field: "name" });
  if (!mm.owner?.name) errors.push({ kind: "missing-field", field: "owner.name" });
  if (!Array.isArray(mm.plugins)) {
    errors.push({ kind: "missing-field", field: "plugins" });
    return errors.length ? { ok: false, errors } : { ok: true };
  }

  const seen = new Set<string>();
  for (const p of mm.plugins) {
    if (!p.name) {
      errors.push({ kind: "missing-field", field: "plugin.name" });
      continue;
    }
    if (seen.has(p.name)) errors.push({ kind: "duplicate-name", name: p.name });
    seen.add(p.name);

    if (typeof p.source === "string") {
      // in-tree, ok
    } else if (p.source && typeof p.source === "object") {
      const s = p.source as ExternalPlugin["source"] | GitSubdirPlugin["source"];
      if (s.source === "url") {
        if (!/^[0-9a-f]{40}$/i.test(s.sha)) {
          errors.push({ kind: "invalid-sha", name: p.name });
        }
      } else if (s.source === "git-subdir") {
        if (!/^[0-9a-f]{40}$/i.test(s.sha)) {
          errors.push({ kind: "invalid-sha", name: p.name });
        }
        if (!s.path) errors.push({ kind: "missing-field", field: `${p.name}.source.path` });
      } else {
        errors.push({ kind: "invalid-source", name: p.name });
      }
    } else {
      errors.push({ kind: "invalid-source", name: p.name });
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
