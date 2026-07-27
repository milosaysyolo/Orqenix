import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { globSync } from "glob";
import { execSync } from "child_process";

const SPDX = "// SPDX-License-Identifier: Apache-2.0";

function isCollapsed(content) {
  const lines = content.split("\n");
  // Only collapsed if ALL lines either empty or start with // or *
  return lines.every(
    (l) => l.trim() === "" || l.trim().startsWith("//") || l.trim().startsWith("*"),
  );
}

function cleanCodeSection(code) {
  // Split JSDoc closing from following export/class/function
  code = code.replace(
    /\*\/(\s*)(export|import|abstract|class|function|const|let|var|type|interface|enum|async)/g,
    "*/\n$2",
  );
  // Split at statement boundaries: } followed by export/import/etc
  code = code.replace(
    /}(\s*)(export|import|abstract|class|function|const|let|var|type|interface|enum|async)/g,
    "}\n\n$2",
  );
  // Split `}//` (close brace + inline comment) properly
  code = code.replace(/}([^}]*?)(\/\/[^\n]*)/g, "}$1\n$2");
  // Remove leading whitespace before exports at top level
  return code;
}

function fixContent(content, filePath) {
  if (!content.startsWith(SPDX) || !isCollapsed(content)) return content;

  const rest = content.slice(SPDX.length);

  // Find code start: first import|export|/**|class|function after header comment
  // Must NOT be preceded by // (to avoid matching inside comments)
  const codeRegex =
    /\b(import\s+(type\s+)?[\{*]|export\s+(type\s+)?[\{*]|export\s+(default\s+)?(class|function|interface|type|const|enum)|abstract\s+class|class\s+\w+\s*(extends|implements|\{)|function\s+\w+\s*\(|\/\*\*)/;
  const cm = rest.match(codeRegex);
  let headerRaw = rest;
  let codeRaw = "";

  if (cm && cm.index > 0) {
    // Only split if this import/export is NOT inside a // comment
    // (i.e., the character right before the match is NOT preceded by // that isn't split yet)
    const beforeMatch = rest.slice(0, cm.index);
    // If there's a // that doesn't have a newline after it, we're still in a comment
    const lastDoubleSlash = beforeMatch.lastIndexOf("//");
    const lastNewline = beforeMatch.lastIndexOf("\n");
    if (lastDoubleSlash <= lastNewline || lastDoubleSlash === -1) {
      headerRaw = beforeMatch;
      codeRaw = rest.slice(cm.index);
    }
  }

  // Split header comments at every `//` boundary
  let headerParts = [];
  let buf = "";
  for (let i = 0; i < headerRaw.length; i++) {
    const ch = headerRaw[i];
    const next = headerRaw[i + 1] || "";

    if (
      ch === "/" &&
      next === "/" &&
      buf.length > 0 &&
      buf[buf.length - 1] !== "\n" &&
      buf[buf.length - 1] !== "/"
    ) {
      headerParts.push(buf);
      // Check for consecutive // (empty comment line like ////)
      if (headerRaw[i + 2] === "/" && headerRaw[i + 3] === "/") {
        // It's //// — empty comment line
        headerParts.push("//");
        buf = "//";
        i += 3; // skip all 4 slashes
      } else {
        buf = "//";
        i++; // skip extra /
      }
      continue;
    }
    buf += ch;
  }
  if (buf.length) headerParts.push(buf);

  // Build result
  let result = SPDX + "\n";
  for (const hp of headerParts) {
    if (hp === "//" || hp.trim() === "//") {
      result += "//\n";
    } else if (hp.trim().startsWith("//")) {
      result += hp.trim() + "\n";
    } else {
      result += hp + "\n";
    }
  }

  // Handle code
  if (codeRaw.trim()) {
    // Strip any non-code prefix (like trailing period from last comment)
    codeRaw = codeRaw.replace(/^[^a-zA-Z0-9_\/\}]+/, "");
    // Clean the code section
    codeRaw = cleanCodeSection(codeRaw);

    const tmpFile = (filePath || ".tmp") + ".fix.ts";
    try {
      writeFileSync(tmpFile, codeRaw, "utf-8");
      try {
        execSync(`npx prettier --write "${tmpFile}"`, { stdio: "pipe", timeout: 30000 });
      } catch {
        // prettier may fail on some patterns; code is still usable
      }
      const formatted = readFileSync(tmpFile, "utf-8");
      result += "\n" + formatted.replace(/\n{3,}/g, "\n\n");
    } finally {
      try {
        unlinkSync(tmpFile);
      } catch {}
    }
  }

  return result;
}

// Fix all source files
const files = globSync("packages/*/src/**/*.{ts,tsx}", { nodir: true });
let fixed = 0;

for (const f of files) {
  // Read from git HEAD (committed version)
  let content;
  try {
    content = execSync(`git show HEAD:"${f.replace(/\\/g, "/")}"`, {
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch {
    content = readFileSync(f, "utf-8");
  }

  if (!content.startsWith(SPDX) || !isCollapsed(content)) continue;

  const fixedContent = fixContent(content, f.replace(/\\/g, "/"));
  if (fixedContent !== content) {
    writeFileSync(f, fixedContent, "utf-8");
    fixed++;
    console.log(`Fixed: ${f}`);
  }
}

console.log(`\nFixed ${fixed} files.`);
