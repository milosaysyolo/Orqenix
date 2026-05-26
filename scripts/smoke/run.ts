import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "orqenix-smoke-"));
const orqenix = process.platform === "win32"
  ? "node_modules/.bin/orqenix.cmd"
  : "node_modules/.bin/orqenix";

const steps: Array<[string, string[]]> = [
  [orqenix, ["init"]],
  [orqenix, ["doctor"]],
  [orqenix, ["history"]],
  [orqenix, ["detach", "--dry-run"]],
];

let failed = 0;
for (const [cmd, args] of steps) {
  const r = spawnSync(cmd, args, { cwd: tmp, stdio: "inherit", shell: true });
  if (r.status !== 0) {
    failed++;
  }
}

rmSync(tmp, { recursive: true, force: true });
process.exit(failed === 0 ? 0 : 1);
