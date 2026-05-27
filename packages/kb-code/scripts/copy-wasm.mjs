import { mkdirSync, copyFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "node_modules", "tree-sitter-wasms", "out");
const dst = join(__dirname, "..", "wasm");

if (!existsSync(src)) {
  console.log("tree-sitter-wasms not installed yet, skipping copy");
  process.exit(0);
}

mkdirSync(dst, { recursive: true });
for (const f of readdirSync(src)) {
  if (f.endsWith(".wasm")) copyFileSync(join(src, f), join(dst, f));
}
console.log("WASM grammars copied.");
