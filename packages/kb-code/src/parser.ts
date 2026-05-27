import Parser from "web-tree-sitter";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GRAMMARS_DIR = join(__dirname, "..", "wasm");

export type SupportedLanguage = "typescript" | "javascript" | "python" | "go";

const grammarFiles: Record<SupportedLanguage, string> = {
  typescript: "tree-sitter-typescript.wasm",
  javascript: "tree-sitter-javascript.wasm",
  python: "tree-sitter-python.wasm",
  go: "tree-sitter-go.wasm",
};

let initialized = false;
const languageCache = new Map<SupportedLanguage, Parser.Language>();

export async function initParser(): Promise<void> {
  if (initialized) return;
  await Parser.init();
  initialized = true;
}

export async function loadLanguage(lang: SupportedLanguage): Promise<Parser.Language> {
  await initParser();
  const cached = languageCache.get(lang);
  if (cached) return cached;
  if (typeof Parser.Language === "undefined") {
    throw new Error("web-tree-sitter WASM runtime not available");
  }
  const wasmPath = join(GRAMMARS_DIR, grammarFiles[lang]);
  const language = await Parser.Language.load(wasmPath);
  languageCache.set(lang, language);
  return language;
}

export async function createParser(lang: SupportedLanguage): Promise<Parser> {
  const language = await loadLanguage(lang);
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

export async function parseSource(
  source: string,
  lang: SupportedLanguage
) {
  const parser = await createParser(lang);
  return parser.parse(source);
}

// Legacy API
export async function loadParser(lang: string): Promise<Parser> {
  await initParser();
  if (typeof Parser.Language === "undefined") {
    throw new Error("web-tree-sitter WASM runtime not available in this environment");
  }
  const supported = lang as SupportedLanguage;
  if (!grammarFiles[supported]) {
    throw new Error(`Unsupported language: ${lang}`);
  }
  return createParser(supported);
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
