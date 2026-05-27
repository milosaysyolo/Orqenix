import { spawnSync } from "node:child_process";
import { join } from "node:path";
const r = spawnSync("npx", ["vitest", "run", "audit"], { cwd: join(process.cwd(), "packages", "lifecycle"), stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
