import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "../..");

const tmp = mkdtempSync(join(tmpdir(), "orqenix-smoke-"));
const cli = join(root, "packages", "cli", "bin", "orqenix.js");

if (!existsSync(cli)) {
  console.error(`CLI not found at ${cli}`);
  process.exit(1);
}

const steps: Array<[string, string[]]> = [
  [cli, ["init"]],
  [cli, ["doctor"]],
  [cli, ["history"]],
  [cli, ["--help"]],
];

let failed = 0;
for (const [cmd, args] of steps) {
  const r = spawnSync("node", [cmd, ...args], { cwd: tmp, stdio: "inherit", shell: false });
  if (r.status !== 0) {
    failed++;
  }
}

rmSync(tmp, { recursive: true, force: true });
process.exit(failed === 0 ? 0 : 1);
