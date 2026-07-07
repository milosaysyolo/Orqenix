// SPDX-License-Identifier: Apache-2.0
// @orqenix/input-adapters , Shared helpers for all input adapters

import type { ImportInput } from "@orqenix/normalization-engine";

export const ADAPTER_VERSION = "0.8.0-alpha.1";

/** Reads input content from inline content or local file path */
export async function readContent(input: ImportInput): Promise<string | null> {
  if (input.content !== undefined) return input.content;
  if (input.path !== undefined) {
    const { readFile } = await import("node:fs/promises");
    const { existsSync } = await import("node:fs");
    if (!existsSync(input.path)) return null;
    return readFile(input.path, "utf-8");
  }
  return null;
}

/** Extracts a basename without extension for naming */
export function basenameNoExt(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? "plugin";
  return base.replace(/\.[^.]+$/, "");
}

/** Sanitizes a string into a valid npm-style plugin name segment */
export function sanitizeName(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned.length > 0 ? cleaned : "imported-plugin";
}

/** Parses YAML frontmatter from a Markdown document */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown> | null;
  body: string;
} {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(content);
  if (!m) return { frontmatter: null, body: content };
  return { frontmatter: { __raw: m[1] }, body: m[2] ?? "" };
}
