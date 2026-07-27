import { readFileSync, writeFileSync } from "fs";
let content = readFileSync("src/index.ts", "utf8");
const lines = content.split("\n");
let result = [];
for (const line of lines) {
  const idx = line.indexOf("// G");
  if (idx >= 0) {
    const after = line.substring(idx);
    const hasExport = after.includes("export") && after.includes("from");
    if (hasExport) {
      const before = line.substring(0, idx);
      result.push(before);
      const exportRegex = /export\s+(type\s+)?\{[^}]+\}\s+from\s+'[^']+';/g;
      const exports = after.match(exportRegex);
      if (exports) {
        for (const exp of exports) {
          const normalized = exp.replace(/,\s*}/g, "}");
          result.push(normalized);
        }
      }
    } else {
      result.push(line);
    }
  } else {
    result.push(line);
  }
}
writeFileSync("src/index.ts", result.join("\n"), "utf8");
console.log("Fixed. Lines:", result.length);
