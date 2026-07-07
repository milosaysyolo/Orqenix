// SPDX-License-Identifier: Apache-2.0
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const ROOT = process.cwd();

async function fix(relPath, fixer) {
  const abs = resolve(ROOT, relPath);
  const before = await readFile(abs, "utf-8");
  const after = fixer(before);
  if (before !== after) {
    await writeFile(abs, after, "utf-8");
    console.log(
      `  FIXED: ${relPath} (${before.split("\n").length} -> ${after.split("\n").length} lines)`,
    );
  } else {
    console.log(`  SKIP:  ${relPath} (no change)`);
  }
}

function splitCodeSection(code) {
  const kws = [
    "import ",
    "export ",
    "const ",
    "let ",
    "var ",
    "function ",
    "class ",
    "describe(",
    "describe.(",
    "it(",
    "it.(",
    "test(",
    "test.(",
    "expect(",
    "expect.(",
    "beforeAll(",
    "afterAll(",
    "beforeEach(",
    "afterEach(",
    "return ",
    "if (",
    "if(",
    "else ",
    "for (",
    "for(",
    "while (",
    "while(",
    "switch (",
    "switch(",
    "try {",
    "try{",
    "catch (",
    "catch(",
    "finally {",
    "finally{",
    "throw ",
    "async ",
    "await ",
    "new ",
  ];
  let r = code;
  for (const kw of kws) {
    r = r.split(";" + kw).join(";\n" + kw);
  }
  const kwPattern =
    "import |export |const |let |var |function |describe\\(|it\\(|test\\(|expect\\(|beforeAll\\(|afterAll\\(";
  r = r.replace(new RegExp("}(\\s*)(" + kwPattern + ")", "g"), "}\n$2");
  const lines = r.split("\n");
  const out = [];
  for (const line of lines) {
    const m = line.match(/^(.*?)\/\/\s*(.+?)\s{2,}(\S.*)$/);
    if (m) {
      out.push(m[1] + "// " + m[2]);
      out.push(m[3]);
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

await fix("packages/binding-core/src/index.ts", (content) => {
  const match = content.match(/export\s*\{([^}]+)\}\s*from\s*'([^']+)'/s);
  if (!match) return content;
  const imports = match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    "export {\n" + imports.map((i) => "  " + i + ",").join("\n") + "\n} from '" + match[2] + "'\n"
  );
});

await (async () => {
  try {
    const pkg = JSON.parse(
      await readFile(resolve(ROOT, "packages/marketplace-ui/package.json"), "utf-8"),
    );
    if (pkg.scripts?.build) {
      await fix(
        "packages/marketplace-ui/tsup.config.ts",
        () =>
          "// SPDX-License-Identifier: Apache-2.0\nimport { defineConfig } from 'tsup';\nexport default defineConfig({\n  entry: { index: 'src/index.ts' },\n  format: ['esm', 'cjs'],\n  dts: true,\n  splitting: false,\n  clean: true,\n  target: 'es2022',\n});\n",
      );
      return;
    }
  } catch {}
  console.log("  SKIP:  packages/marketplace-ui/tsup.config.ts (no package.json)");
})();

const testFiles = [
  "packages/instinct-promoter/tests/candidate-card.test.tsx",
  "packages/self-learning-detection/tests/candidate-store.test.ts",
  "packages/self-learning-observer/tests/observer-config.test.ts",
  "packages/self-learning-observer/tests/pii-filter.test.ts",
];
for (const tf of testFiles) {
  await fix(tf, splitCodeSection);
}
console.log("\nDone.");
