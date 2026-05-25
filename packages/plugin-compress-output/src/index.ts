import type { OrqenixPlugin, ToolOutput } from "@orqenix/core/plugin";

export interface CompressOutputConfig {
  enabled: boolean;
  thresholdTokens: number;
  typeAware: boolean;
  preserveHandles: boolean;
}

const DEFAULT_CONFIG: CompressOutputConfig = {
  enabled: true,
  thresholdTokens: 2000,
  typeAware: true,
  preserveHandles: true,
};

const TOKENS_PER_CHAR = 0.25;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length * TOKENS_PER_CHAR);
}

export type OutputType = "file_list" | "logs" | "json" | "table" | "diff" | "search_results" | "unknown";

export function detectOutputType(output: unknown): OutputType {
  if (Array.isArray(output)) {
    if (output.every((x) => typeof x === "string" && /^[/.\w\-]+$/.test(x))) {
      return "file_list";
    }
    if (output.every((x) => typeof x === "object" && x !== null && "score" in x)) {
      return "search_results";
    }
    return "json";
  }
  if (typeof output === "string") {
    if (/^diff --git|^@@|^\+\+\+|^---/m.test(output)) return "diff";
    if (/^\d{4}-\d{2}-\d{2}/m.test(output) && output.split("\n").length > 5) return "logs";
    if (/^\|.*\|/m.test(output)) return "table";
  }
  if (typeof output === "object" && output !== null) return "json";
  return "unknown";
}

export function compressFileList(files: string[]): string {
  if (files.length <= 10) return JSON.stringify(files, null, 2);
  const prefixes = new Map<string, number>();
  for (const f of files) {
    const prefix = f.split("/").slice(0, -1).join("/");
    prefixes.set(prefix, (prefixes.get(prefix) ?? 0) + 1);
  }
  const sortedPrefixes = [...prefixes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const lines = sortedPrefixes.map(([p, n]) => `  ${p}/  (${n} files)`);
  lines.push(`  ... and ${files.length - sortedPrefixes.reduce((s, [, n]) => s + n, 0)} others`);
  return `File list (${files.length} total):\n${lines.join("\n")}`;
}

export function compressLogs(text: string): string {
  const lines = text.split("\n");
  const counted = new Map<string, number>();
  const errors: string[] = [];
  for (const line of lines) {
    if (/error|exception|panic|fatal/i.test(line)) {
      errors.push(line);
      continue;
    }
    const normalized = line
      .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?/g, "{ts}")
      .replace(/\b[a-f0-9]{8,}\b/gi, "{hex}")
      .replace(/\b\d+\b/g, "{n}");
    counted.set(normalized, (counted.get(normalized) ?? 0) + 1);
  }
  const top = [...counted.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const out: string[] = [];
  if (errors.length) {
    out.push("ERRORS (verbatim):");
    out.push(...errors.slice(0, 20));
    if (errors.length > 20) out.push(`  ... +${errors.length - 20} more`);
    out.push("");
  }
  out.push(`OTHER LOG LINES (${lines.length} total, deduplicated):`);
  for (const [pattern, count] of top) {
    out.push(`  [×${count}] ${pattern}`);
  }
  return out.join("\n");
}

export function compressJson(obj: unknown): string {
  if (Array.isArray(obj)) {
    const sample = obj.slice(0, 3);
    const last = obj.length > 4 ? obj[obj.length - 1] : null;
    return JSON.stringify(
      {
        _orqenix_compressed: true,
        total: obj.length,
        first3: sample,
        last: last,
      },
      null,
      2,
    );
  }
  if (typeof obj === "object" && obj !== null) {
    const schema: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      schema[k] = typeof v;
    }
    return JSON.stringify({ _orqenix_compressed: true, schema, raw: obj }, null, 2);
  }
  return JSON.stringify(obj);
}

export function compressSearchResults(results: Array<{ score: number; [k: string]: unknown }>): string {
  if (results.length <= 5) return JSON.stringify(results, null, 2);
  const top5 = results.slice(0, 5);
  return JSON.stringify(
    {
      _orqenix_compressed: true,
      total: results.length,
      top5,
      score_range: {
        max: results[0]?.score,
        min: results[results.length - 1]?.score,
      },
    },
    null,
    2,
  );
}

export function compressOutput(output: unknown, type: OutputType): unknown {
  if (type === "file_list" && Array.isArray(output)) return compressFileList(output as string[]);
  if (type === "logs" && typeof output === "string") return compressLogs(output);
  if (type === "json") return compressJson(output);
  if (type === "search_results" && Array.isArray(output))
    return compressSearchResults(output as Array<{ score: number }>);
  if (typeof output === "string" && output.length > 4000) {
    return output.slice(0, 2000) + `\n\n... [${output.length - 4000} chars truncated] ...\n\n` + output.slice(-2000);
  }
  return output;
}

export function createPlugin(userConfig: Partial<CompressOutputConfig> = {}): OrqenixPlugin {
  const config: CompressOutputConfig = { ...DEFAULT_CONFIG, ...userConfig };

  return {
    name: "compress-output",
    version: "0.3.0-dev",
    description: "Type-aware compression of tool outputs",
    priority: 70,
    capabilities: ["compression", "output-optimization"],
    hooks: {
      "tool.execute.after": async (output: ToolOutput, _ctx) => {
        if (!config.enabled) return output;
        const serialized = typeof output.result === "string" ? output.result : JSON.stringify(output.result);
        const tokens = estimateTokens(serialized);
        if (tokens < config.thresholdTokens) return output;

        const type = config.typeAware ? detectOutputType(output.result) : "unknown";
        const compressed = compressOutput(output.result, type);
        return { ...output, result: compressed };
      },
    },
  };
}

export const plugin = createPlugin();
export default plugin;
