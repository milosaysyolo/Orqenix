import Parser from "web-tree-sitter";
import { join } from "node:path";

let parserReady: Promise<void> | null = null;

async function ensureReady() {
  if (!parserReady) parserReady = Parser.init();
  await parserReady;
}

export async function loadParser(lang: string): Promise<Parser> {
  await ensureReady();
  if (typeof Parser.Language === "undefined") {
    throw new Error("web-tree-sitter WASM runtime not available in this environment");
  }
  const wasmPath = join(__dirname, "..", "wasm", `tree-sitter-${lang}.wasm`);
  const language = await Parser.Language.load(wasmPath);
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

export function detectLang(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
    js: "typescript", jsx: "typescript", mjs: "typescript", cjs: "typescript",
    py: "python", rs: "rust", go: "go",
  };
  return map[ext] ?? "typescript";
}
