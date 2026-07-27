import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { globSync } from "glob";
import { execSync } from "child_process";
import path from "path";

const SPDX = "// SPDX-License-Identifier: Apache-2.0";

function isAlreadyFixed(content) {
  const lines = content.split("\n");
  return lines.some((l) => l.trim() && !l.trim().startsWith("//") && !l.trim().startsWith("*"));
}

function fixSingleLineCode(codeSection) {
  // Collapsed code section: `import ...;export ...;export class ... {`
  // Split at: `;` followed by statement, `}` followed by statement, etc.
  // Then run prettier

  // Strategy: insert \n at statement boundaries
  let result = codeSection;

  // Split after semicolons (statement boundaries)
  result = result.replace(/;(?!\s*$)/g, ";\n");

  // Split before top-level statements
  result = result.replace(
    /\n(export|import|abstract|class|function|const|let|var|type|interface|enum)/g,
    "\n\n$1",
  );

  // For inline // comments, split the code after the comment
  result = result.replace(/(\/\/[^\n]*?)(\s{3,})([a-zA-Z_])/g, "$1\n$3");

  // Split closing braces of class/functions from next statement
  result = result.replace(
    /}\s*(export|import|abstract|class|function|const|let|var|type|interface|enum)/g,
    "}\n\n$1",
  );

  return result;
}

function fixContent(content, filePath) {
  if (!content.startsWith(SPDX) || isAlreadyFixed(content)) return content;

  // Find the boundary between header comments and code
  // The code starts at the first `import `, `export `, `/** JSDoc`, or class/function keyword
  // that follows the header comment block
  const rest = content.slice(SPDX.length);

  // Find code start boundary
  const codeStartMatch = rest.match(
    /\b(import\s+(type\s+)?[\{*]|export\s+|\/\*\*|(abstract\s+)?class\s+\w+|function\s+\w+)/,
  );
  let headerPart = rest;
  let codePart = "";

  if (codeStartMatch && codeStartMatch.index > 0) {
    headerPart = rest.slice(0, codeStartMatch.index);
    codePart = rest.slice(codeStartMatch.index);
  }

  // Fix header: split at every `//` that follows non-`/` content
  let fixedHeader = "";
  let buf = "";
  for (let i = 0; i < headerPart.length; i++) {
    const ch = headerPart[i];
    const next = headerPart[i + 1] || "";

    if (
      ch === "/" &&
      next === "/" &&
      buf.length > 0 &&
      buf[buf.length - 1] !== "\n" &&
      buf[buf.length - 1] !== "/"
    ) {
      fixedHeader += buf + "\n";
      buf = "";
      fixedHeader += "//";
      i++;
      continue;
    }
    buf += ch;
  }
  if (buf.length) fixedHeader += buf;

  // Build result
  let result = SPDX + "\n";

  // Add header lines with proper formatting
  const headerLines = fixedHeader.split("\n");
  for (let li = 0; li < headerLines.length; li++) {
    const line = headerLines[li];
    if (line.trim() === "") {
      result += "\n";
    } else if (line.startsWith("//") || line.trim().startsWith("//")) {
      result += line.trim() + "\n";
    } else {
      result += line + "\n";
    }
  }

  // Handle code section
  if (codePart.trim()) {
    // Remove any trailing period/whitespace from header that got mixed with code
    codePart = codePart.replace(/^[^a-zA-Z0-9_\/]+/, "");

    // Try formatting with prettier
    const tmpFile = filePath + ".fix-tmp.ts";
    try {
      writeFileSync(tmpFile, codePart, "utf-8");
      try {
        execSync(`npx prettier --write "${tmpFile}"`, { stdio: "pipe", timeout: 30000 });
      } catch {
        // prettier might fail — use simple formatting as fallback
        const simpleCode = fixSingleLineCode(codePart);
        writeFileSync(tmpFile, simpleCode, "utf-8");
        try {
          execSync(`npx prettier --write "${tmpFile}"`, { stdio: "pipe", timeout: 30000 });
        } catch {}
      }
      const formatted = readFileSync(tmpFile, "utf-8");
      result += "\n" + formatted;
    } finally {
      try {
        unlinkSync(tmpFile);
      } catch {}
    }
  }

  return result;
}

// Fix all corrupted files
const files = globSync("packages/*/src/**/*.{ts,tsx}", { nodir: true });
let fixed = 0;

for (const f of files) {
  let content;
  try {
    content = execSync(`git show HEAD:"${f.replace(/\\/g, "/")}"`, {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
  } catch {
    content = readFileSync(f, "utf-8");
  }

  if (!content.startsWith(SPDX) || isAlreadyFixed(content)) continue;

  const fixedContent = fixContent(content, f.replace(/\\/g, "/"));
  if (fixedContent !== content) {
    writeFileSync(f, fixedContent, "utf-8");
    fixed++;
    console.log(`Fixed: ${f}`);
  }
}

console.log(`\nFixed ${fixed} files.`);
