import { readFileSync, writeFileSync } from "fs";
import { globSync } from "glob";

const SPDX = "// SPDX-License-Identifier: Apache-2.0";

function fixContent(content) {
  if (!content.startsWith(SPDX)) return content;
  const lines = content.split("\n");
  // true-code lines (not all-comment)
  const realCode = lines.filter((l) => l.trim() && !l.trim().startsWith("//"));
  if (realCode.length > 0) return content;

  const rest = content.slice(SPDX.length);

  // 1. Insert newline after SPDX line
  let result = SPDX + "\n";

  // 2. Split collapsed comment/code lines
  //    Walk through rest. Every `//` that follows non-`/` content is a
  //    new logical line. But track slash-containing tokens in code.
  let buf = "";
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    const next = rest[i + 1] || "";

    if (
      ch === "/" &&
      next === "/" &&
      buf.length > 0 &&
      buf[buf.length - 1] !== "\n" &&
      buf[buf.length - 1] !== "/" &&
      buf[buf.length - 1] !== ":"
    ) {
      // This // starts a new logical line (collapsed comment or code)
      result += buf + "\n//";
      buf = "";
      i++; // consume extra /
      continue;
    }

    buf += ch;
  }
  if (buf.length > 0) result += buf;

  // 3. Verify we now have real code lines (not starting with //)
  const outLines = result.split("\n");
  const codeLinesAfter = outLines.filter((l) => l.trim() && !l.trim().startsWith("//"));
  if (codeLinesAfter.length === 0) {
    // Still all comments — likely code was concatenated without // marker.
    // Try splitting at common code-start keywords after period/paren/bracket.
    const codeStart =
      /\b(export\s+(default\s+)?(class|function|interface|type|const|enum|abstract\s+class|async\s+function)|import\s+(type\s+)?\{|import\s+type\s+\*|abstract\s+class|class\s+\w+|function\s+\w+|const\s+\w+:\s*\w|type\s+\w+\s*=|interface\s+\w+)/;
    const lines = result.split("\n");
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      // Check if this line is a comment line that has code appended
      if (line.startsWith("//") || line.trim() === "") continue;
      // Try to find a split point
      const m = line.match(codeStart);
      if (m && m.index > 0) {
        const before = line.slice(0, m.index);
        const after = line.slice(m.index);
        // Remove trailing non-alphanumeric from before (like period)
        const trimmedBefore = before.replace(/[^a-zA-Z0-9)]+$/, "");
        if (trimmedBefore.length < before.length) {
          lines[li] = trimmedBefore;
          lines.splice(li + 1, 0, after);
          li++; // skip inserted line
        }
      }
    }
    result = lines.join("\n");
  }

  return result;
}

// Fix all .ts/.tsx files in packages
const files = globSync("packages/*/src/**/*.{ts,tsx}", { nodir: true });
let fixed = 0;
for (const f of files) {
  const orig = readFileSync(f, "utf-8");
  const updated = fixContent(orig);
  if (updated !== orig) {
    writeFileSync(f, updated, "utf-8");
    fixed++;
    console.log(`Fixed: ${f}`);
  }
}
console.log(`\nFixed ${fixed} collapsed files.`);

// Also strip U+FFFD from all package.json files
const pkgFiles = globSync("packages/*/package.json", { nodir: true });
let pkgFixed = 0;
for (const f of pkgFiles) {
  const orig = readFileSync(f, "utf-8");
  const cleaned = orig.replace(/\uFFFD/g, "");
  if (cleaned !== orig) {
    writeFileSync(f, cleaned, "utf-8");
    pkgFixed++;
    console.log(`Cleaned U+FFFD from: ${f}`);
  }
}
console.log(`\nCleaned ${pkgFixed} package.json files.`);
