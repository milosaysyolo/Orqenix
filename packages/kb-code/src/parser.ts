import Parser from "web-tree-sitter";
import { createRequire } from "node:module";

const localRequire = createRequire(__filename);

type ParserRuntime = {
  new (): Parser;
  Language?: {
    load(input: string | Uint8Array): Promise<Parser.Language>;
  };
  init(options?: object): Promise<unknown>;
};

const parserCtor = Parser as unknown as ParserRuntime;
const parserState = Parser as unknown as Record<string, unknown>;

const LANG_TO_WASM: Record<string, string> = {
  typescript: "tree-sitter-wasms/out/tree-sitter-typescript.wasm",
  tsx: "tree-sitter-wasms/out/tree-sitter-tsx.wasm",
  javascript: "tree-sitter-wasms/out/tree-sitter-javascript.wasm",
  python: "tree-sitter-wasms/out/tree-sitter-python.wasm",
  rust: "tree-sitter-wasms/out/tree-sitter-rust.wasm",
  go: "tree-sitter-wasms/out/tree-sitter-go.wasm",
  java: "tree-sitter-wasms/out/tree-sitter-java.wasm",
  ruby: "tree-sitter-wasms/out/tree-sitter-ruby.wasm",
  cpp: "tree-sitter-wasms/out/tree-sitter-cpp.wasm",
  c: "tree-sitter-wasms/out/tree-sitter-c.wasm",
};

let initialized = false;
const langCache = new Map<string, Parser.Language>();

export async function loadParser(lang: string): Promise<Parser> {
  const runtime = parserCtor;

  if (!initialized) {
    await runtime.init({
      locateFile(scriptName: string) {
        if (scriptName === "tree-sitter.wasm") {
          return localRequire.resolve("web-tree-sitter/tree-sitter.wasm");
        }
        return scriptName;
      },
    });
    initialized = true;
  }
  let langMod = langCache.get(lang);
  if (!langMod) {
    const wasmFile = LANG_TO_WASM[lang];
    if (!wasmFile) throw new Error(`Unsupported language: ${lang}`);
    try {
      const wasmPath = localRequire.resolve(wasmFile);
      const languageApi = runtime.Language ?? (parserState.Language as ParserRuntime["Language"] | undefined);
      if (!languageApi) {
        throw new Error("Parser.Language is unavailable after init()");
      }
      langMod = await languageApi.load(wasmPath);
      langCache.set(lang, langMod);
    } catch (e) {
      throw new Error(`Failed to load parser for ${lang}: ${e}`);
    }
  }
  const parser = new runtime();
  parser.setLanguage(langMod);
  return parser;
}
