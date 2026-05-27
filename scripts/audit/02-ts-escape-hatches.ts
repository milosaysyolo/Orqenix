#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { globSync } from "glob";

const files = globSync("packages/**/src/**/*.ts", { ignore: "**/*.test.ts" });
const offenders: { file: string; lineNo: number; line: string }[] = [];

for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (/@ts-expect-error|@ts-ignore|@ts-nocheck|: any\b/.test(line)) {
      offenders.push({ file: f, lineNo: i + 1, line: line.trim() });
    }
  });
}

for (const o of offenders) {
  console.log(`${o.file}:${o.lineNo}  ${o.line}`);
}
console.log(`\nTotal escape hatches: ${offenders.length}`);
process.exit(offenders.length === 0 ? 0 : 1);
