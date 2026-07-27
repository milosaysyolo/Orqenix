import { readFileSync, writeFileSync } from "fs";
import { globSync } from "glob";

const SPDX = "// SPDX-License-Identifier: Apache-2.0";

function isCollapsed(content) {
  return content
    .split("\n")
    .every((l) => l.trim() === "" || l.trim().startsWith("//") || l.trim().startsWith("*"));
}

function splitLines(raw) {
  const lines = [];
  let buf = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i],
      next = raw[i + 1] || "";
    if (
      ch === "/" &&
      next === "/" &&
      buf.length > 0 &&
      buf[buf.length - 1] !== "\n" &&
      buf[buf.length - 1] !== "/"
    ) {
      lines.push(buf);
      if (raw[i + 2] === "/" && raw[i + 3] === "/") {
        lines.push("//");
        buf = "//";
        i += 3;
      } else {
        buf = "//";
        i++;
      }
      continue;
    }
    buf += ch;
  }
  if (buf) lines.push(buf);
  return lines;
}

function fix(file) {
  let content = readFileSync(file, "utf-8");
  if (!content.startsWith(SPDX) || !isCollapsed(content)) return false;

  const rest = content.slice(SPDX.length);
  const lines = splitLines(rest);

  const codePattern = /\b(import\s+|export\s+|\/\*\*|abstract\s+class|class\s+\w+|function\s+\w+)/;
  let header = [];
  let codeParts = [];
  let inCode = false;

  for (const line of lines) {
    if (inCode) {
      codeParts.push(line);
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed.startsWith("//") && trimmed) {
      codeParts.push(line);
      inCode = true;
      continue;
    }
    const m = line.match(codePattern);
    if (m && m.index > 0) {
      header.push(line.slice(0, m.index).replace(/[^a-zA-Z0-9)\]}\/\n]+$/, ""));
      codeParts.push(line.slice(m.index));
      inCode = true;
      continue;
    }
    header.push(line);
  }

  // Build header
  let result = SPDX + "\n";
  for (const h of header) {
    const t = h.trim();
    if (!t || t === "//") result += "//\n";
    else if (t.startsWith("//")) result += t + "\n";
    else result += h + "\n";
  }

  // Process code
  if (codeParts.length) {
    let code = codeParts.join("");
    code = code.replace(/^[^a-zA-Z0-9_\/\{\[\(@"']+/, "");

    // Handle inline //: extract code after comment text
    // Keywords that could follow: return, const, let, var, if, for, while, switch,
    // try, catch, finally, throw, this., await, async, function, class, },
    // and structural patterns like };, })
    const kwAfterComment =
      /(\/\/[^\n]*?)\s{2,}(return |const |let |var |if |for |while |switch |try |catch |finally |throw |this\.|await |async |function |class |\}\s*|\]\s*\)\s*|\]\s*;)/g;
    code = code.replace(kwAfterComment, "$1\n$2");

    // Also handle `// comment}export` -> `// comment\nexport`
    code = code.replace(
      /\/\/[^\n]*?\}(\s*)(export |import |abstract |class |function |const |let |var |type |interface |enum )/g,
      "//\n$2",
    );

    // Split JSDoc from statement
    code = code.replace(
      /\*\/(\s*)(export |import |abstract |class |function |const |let |var |type |interface |enum |async )/g,
      "*/\n$2",
    );

    // Split at ; followed by statement keyword
    const afterSemicolon =
      /;(\s*)(export |import |abstract |class |function |const |let |var |type |interface |enum |case\s|async |public |private |protected |static |readonly |\/\*\*)/g;
    code = code.replace(afterSemicolon, ";\n$2");

    // Split at } followed by JSDoc or export/import
    code = code.replace(/}\s*(\/\*\*|export\s|import\s)/g, "}\n$1");

    // handle `};` at end of statement (when ; is after })
    // This ensures `};export` -> `};\nexport` etc.
    code = code.replace(/;}\s*([a-zA-Z_])/g, ";}\n$1");

    // Split `}case` -> `}\ncase` for switch statements
    code = code.replace(/}\s*case\s/g, "}\ncase ");

    // Split `// comment};` -> `// comment\n};` (inline // eating closing braces)
    code = code.replace(/(\/\/[^\n]*?)(\};)/g, "$1\n$2");
    // Split `// comment}keyword` -> `// comment\n}keyword`
    code = code.replace(
      /(\/\/[^\n]*?\w)(\s*)(\})(\s*)(case\s|export\s|import\s|class\s|function\s|const\s|let\s|var\s|type\s|interface\s|enum\s|async\s)/g,
      "$1\n$3$4$5",
    );

    // Strip U+FFFD replacement characters
    code = code.replace(/\uFFFD/g, "");

    result += "\n" + code;
  }

  writeFileSync(file, result, "utf-8");
  return true;
}

const files = globSync("packages/*/src/**/*.{ts,tsx}", { nodir: true });
let fixed = 0;
for (const f of files) {
  if (fix(f)) {
    fixed++;
    console.log(`Fixed: ${f}`);
  }
}
console.log(`\nFixed ${fixed} files.`);
