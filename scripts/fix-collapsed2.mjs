import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { globSync } from "glob";
import { execSync } from "child_process";

const SPDX = "// SPDX-License-Identifier: Apache-2.0";
const CODE_STARTERS =
  /\b(import\s|export\s|\/\*\*|abstract\s|class\s|function\s|const\s|let\s|var\s|type\s|interface\s|enum\s|async\s)/;

function fixContent(content, filePath) {
  if (!content.startsWith(SPDX)) return content;
  const lines = content.split("\n");
  if (lines.some((l) => l.trim() && !l.trim().startsWith("//") && !l.trim().startsWith("*")))
    return content;

  const rest = content.slice(SPDX.length);

  // Phase 1: Split header comment lines at every `//` that follows non-`/` content
  // These represent original line boundaries in the collapsed file
  let parts = [];
  let buf = "";
  let i = 0;

  while (i < rest.length) {
    const ch = rest[i];
    const next = rest[i + 1] || "";

    // A `//` that follows non-`/` content = original line boundary
    if (
      ch === "/" &&
      next === "/" &&
      buf.length > 0 &&
      buf[buf.length - 1] !== "\n" &&
      buf[buf.length - 1] !== "/"
    ) {
      parts.push(buf);
      buf = "";
      parts.push("//"); // the comment prefix for the next logical line
      i += 2;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf.length > 0) parts.push(buf);

  // Phase 2: Separate header comments from code
  let headerLines = [];
  let codeContent = "";
  let inCode = false;

  // Join consecutive `//` prefixes with their content
  for (let pi = 0; pi < parts.length; pi++) {
    if (inCode) {
      codeContent += parts[pi];
      continue;
    }

    if (parts[pi] === "//" && pi + 1 < parts.length) {
      // Read the content after // until next // or end
      let commentContent = "//";
      let ci = pi + 1;
      while (ci < parts.length && parts[ci] !== "//") {
        commentContent += parts[ci];
        ci++;
      }

      // Check if this comment line has code appended
      const codeMatch = commentContent.match(CODE_STARTERS);
      if (codeMatch && codeMatch.index > 0) {
        // Split: keep comment text up to code start, code goes to code section
        const commentPart = commentContent
          .slice(0, codeMatch.index)
          .replace(/[^a-zA-Z0-9)\]]$/, "");
        const codePart = commentContent.slice(codeMatch.index);
        headerLines.push(commentPart);
        codeContent = codePart;
        // Also include any remaining parts
        for (let ri = ci; ri < parts.length; ri++) {
          codeContent += parts[ri];
        }
        inCode = true;
        break;
      }

      headerLines.push(commentContent);
      pi = ci - 1; // will be incremented by for loop
      continue;
    }

    if (parts[pi] === "//" && pi === parts.length - 1) {
      headerLines.push("//");
      continue;
    }

    // Non-`//` content that's not after a `//` prefix — this is code
    // Only happens when code follows without `//` marker
    const codeCheck = parts[pi].match(CODE_STARTERS);
    if (codeCheck) {
      codeContent = parts[pi];
      inCode = true;
    } else {
      headerLines.push(parts[pi]);
    }
  }

  // Phase 3: Reconstruct with proper newlines
  let result = SPDX + "\n\n";
  for (const h of headerLines) {
    if (h.startsWith("//") || h.trim() === "") {
      result += h + "\n";
    } else {
      result += "// " + h + "\n";
    }
  }

  if (codeContent.trim()) {
    // Format code with prettier
    const tmpFile = filePath + ".fix-tmp.ts";
    try {
      writeFileSync(tmpFile, codeContent, "utf-8");
      try {
        execSync(`npx prettier --write "${tmpFile}"`, { stdio: "pipe", timeout: 30000 });
      } catch (pf) {
        // prettier might fail on collapsed code, that's OK
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

// Find corrupted files from git HEAD
const files = globSync("packages/*/src/**/*.{ts,tsx}", { nodir: true });
let fixed = 0;

for (const f of files) {
  // Get the committed (collapsed) version
  let committedContent;
  try {
    committedContent = execSync(`git show HEAD:"${f}"`, {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
  } catch {
    // File might not be tracked
    committedContent = readFileSync(f, "utf-8");
  }

  if (!committedContent.startsWith(SPDX)) continue;

  const fixedContent = fixContent(committedContent, f);
  if (fixedContent !== committedContent) {
    writeFileSync(f, fixedContent, "utf-8");
    fixed++;
    console.log(`Fixed: ${f}`);
  }
}

console.log(`\nFixed ${fixed} files.`);
