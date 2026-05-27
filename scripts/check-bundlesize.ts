import { readFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

interface BundleEntry {
  path: string;
  maxSize: string;
  compression: "none" | "gzip" | "brotli";
}

interface Config {
  files: BundleEntry[];
}

function parseSize(s: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*(kB|KB|MB|B)$/.exec(s.trim());
  if (!m) throw new Error(`Invalid size: ${s}`);
  const n = parseFloat(m[1]!);
  const unit = m[2]!;
  switch (unit) {
    case "B":
      return n;
    case "KB":
    case "kB":
      return n * 1024;
    case "MB":
      return n * 1024 * 1024;
    default:
      throw new Error(`Unknown unit: ${unit}`);
  }
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  const configRaw = await readFile(join(ROOT, "bundlesize.config.json"), "utf8");
  const config: Config = JSON.parse(configRaw);

  let failed = 0;
  for (const entry of config.files) {
    const abs = join(ROOT, entry.path);
    let size: number;
    try {
      const s = await stat(abs);
      size = s.size;
    } catch {
      console.error(`MISSING ${entry.path}`);
      failed++;
      continue;
    }

    const max = parseSize(entry.maxSize);
    if (size > max) {
      console.error(
        `FAIL ${entry.path}: ${fmtBytes(size)} > ${entry.maxSize}`
      );
      failed++;
    } else {
      const pct = ((size / max) * 100).toFixed(0);
      console.log(`PASS ${entry.path}: ${fmtBytes(size)} / ${entry.maxSize} (${pct}%)`);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} bundle(s) over budget`);
    process.exit(1);
  }
  console.log(`\nAll ${config.files.length} bundles within budget`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
